import { Injectable } from '@nestjs/common';

import { DEFAULT_MAP_ID, MAP_DATA_REGISTRY } from '@cesar-mmo/shared';

import type { Direction, MapId, Player } from '@cesar-mmo/shared';

import type { PokemonTrainerId } from 'src/pokemon/pokemon-trainer-identity';

import { PlayerWorldLocationRepository } from './player-world-location.repository';

import type { PlayerWorldLocation } from './player-world.types';

interface PlayerWorldFlushEntry {
  readonly trainerId: PokemonTrainerId;
  readonly player: Player;
}

@Injectable()
export class PlayerWorldStateService {
  constructor(
    private readonly playerWorldLocationRepository: PlayerWorldLocationRepository,
  ) {}

  private readonly locationWriteQueues = new Map<
    PokemonTrainerId,
    Promise<void>
  >();

  async loadInitialLocation(
    trainerId: PokemonTrainerId,
  ): Promise<PlayerWorldLocation> {
    await this.waitForPendingLocationWrite(trainerId);

    const persisted = await this.playerWorldLocationRepository.load(trainerId);

    if (!persisted) {
      console.warn('[PlayerWorldState] Persisted trainer location not found', {
        trainerId,
      });

      return this.getDefaultLocation();
    }

    if (!persisted.mapId || !this.isKnownMapId(persisted.mapId)) {
      const fallback = this.getDefaultLocation();

      console.warn('[PlayerWorldState] Invalid persisted map; using fallback', {
        trainerId,
        persistedMapId: persisted.mapId,
        fallbackMapId: fallback.mapId,
      });

      await this.repairPersistedLocationBestEffort(
        trainerId,
        fallback,
        'invalid-map',
      );

      return fallback;
    }

    if (
      persisted.x === null ||
      persisted.y === null ||
      !this.isValidPosition(persisted.mapId, persisted.x, persisted.y)
    ) {
      const fallback = this.getDefaultLocation();

      console.warn(
        '[PlayerWorldState] Invalid persisted position; using fallback',
        {
          trainerId,
          persistedMapId: persisted.mapId,
          persistedX: persisted.x,
          persistedY: persisted.y,
          fallbackMapId: fallback.mapId,
          fallbackX: fallback.x,
          fallbackY: fallback.y,
        },
      );

      await this.repairPersistedLocationBestEffort(
        trainerId,
        fallback,
        'invalid-position',
      );

      return fallback;
    }

    const direction =
      persisted.direction && this.isDirection(persisted.direction)
        ? persisted.direction
        : 'down';

    const location: PlayerWorldLocation = {
      mapId: persisted.mapId,
      x: persisted.x,
      y: persisted.y,
      direction,
    };

    if (direction !== persisted.direction) {
      console.warn(
        '[PlayerWorldState] Invalid persisted direction; repairing',
        {
          trainerId,
          persistedDirection: persisted.direction,
          repairedDirection: direction,
        },
      );

      await this.repairPersistedLocationBestEffort(
        trainerId,
        location,
        'invalid-direction',
      );
    }

    return location;
  }

  private getDefaultLocation(): PlayerWorldLocation {
    const mapData = MAP_DATA_REGISTRY[DEFAULT_MAP_ID];

    return {
      mapId: DEFAULT_MAP_ID,
      x: mapData.spawn.x,
      y: mapData.spawn.y,
      direction: 'down',
    };
  }

  private isKnownMapId(value: string): value is MapId {
    return Object.prototype.hasOwnProperty.call(MAP_DATA_REGISTRY, value);
  }

  private isDirection(value: string): value is Direction {
    return (
      value === 'up' ||
      value === 'down' ||
      value === 'left' ||
      value === 'right'
    );
  }

  private isValidPosition(mapId: MapId, x: number, y: number): boolean {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return false;
    }

    const mapData = MAP_DATA_REGISTRY[mapId];

    return (
      x >= 0 &&
      y >= 0 &&
      x < mapData.widthInPixels &&
      y < mapData.heightInPixels
    );
  }

  async saveLocation(
    trainerId: PokemonTrainerId,
    location: PlayerWorldLocation,
  ): Promise<void> {
    await this.enqueueLocationSave(trainerId, location);
  }

  checkpointPlayer(trainerId: PokemonTrainerId, player: Player): void {
    void this.saveLocation(trainerId, {
      mapId: player.mapId,
      x: player.x,
      y: player.y,
      direction: player.direction,
    }).catch((error: unknown) => {
      console.warn('[PlayerWorldState] Checkpoint failed', {
        trainerId,
        playerId: player.id,
        error,
      });
    });
  }

  private enqueueLocationSave(
    trainerId: PokemonTrainerId,
    location: PlayerWorldLocation,
  ): Promise<void> {
    const previous =
      this.locationWriteQueues.get(trainerId) ?? Promise.resolve();

    const next = previous
      .catch(() => undefined)
      .then(() => this.playerWorldLocationRepository.save(trainerId, location));

    this.locationWriteQueues.set(trainerId, next);

    void next.then(
      () => {
        this.cleanupLocationWriteQueue(trainerId, next);
      },
      () => {
        this.cleanupLocationWriteQueue(trainerId, next);
      },
    );

    return next;
  }

  private cleanupLocationWriteQueue(
    trainerId: PokemonTrainerId,
    write: Promise<void>,
  ): void {
    if (this.locationWriteQueues.get(trainerId) === write) {
      this.locationWriteQueues.delete(trainerId);
    }
  }

  private async waitForPendingLocationWrite(
    trainerId: PokemonTrainerId,
  ): Promise<void> {
    while (true) {
      const pending = this.locationWriteQueues.get(trainerId);
      if (!pending) {
        return;
      }
      try {
        await pending;
      } catch (error: unknown) {
        console.warn('[PlayerWorldState] Pending location write failed', {
          trainerId,
          error,
        });
      }
      const current = this.locationWriteQueues.get(trainerId);
      if (!current || current === pending) {
        return;
      }
    }
  }

  async flushPlayers(entries: readonly PlayerWorldFlushEntry[]): Promise<void> {
    if (entries.length === 0) {
      return;
    }

    const results = await Promise.allSettled(
      entries.map(({ trainerId, player }) =>
        this.saveLocation(trainerId, {
          mapId: player.mapId,
          x: player.x,
          y: player.y,
          direction: player.direction,
        }),
      ),
    );

    const failedWrites = results.filter(
      (result) => result.status === 'rejected',
    );

    if (failedWrites.length > 0) {
      console.error(
        '[PlayerWorldState] Graceful flush completed with failures',
        {
          total: entries.length,
          failed: failedWrites.length,
        },
      );

      return;
    }

    console.log('[PlayerWorldState] Graceful flush completed', {
      total: entries.length,
    });
  }

  private async repairPersistedLocationBestEffort(
    trainerId: PokemonTrainerId,
    location: PlayerWorldLocation,
    reason: string,
  ): Promise<void> {
    try {
      await this.saveLocation(trainerId, location);
    } catch (error: unknown) {
      console.warn('[PlayerWorldState] Failed to repair persisted location', {
        trainerId,
        reason,
        error,
      });
    }
  }
}
