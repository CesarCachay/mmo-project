import { Injectable } from '@nestjs/common';

import { DEFAULT_MAP_ID, MAP_DATA_REGISTRY } from '@cesar-mmo/shared';

import type { Direction, MapId } from '@cesar-mmo/shared';

import type { PokemonTrainerId } from '#app/pokemon/pokemon-trainer-identity';

import { PlayerRecoveryCheckpointRepository } from './player-recovery-checkpoint.repository';

import type {
  PersistedPlayerRecoveryCheckpoint,
  PlayerRecoveryCheckpoint,
} from './player-world.types';

@Injectable()
export class PlayerRecoveryCheckpointService {
  constructor(
    private readonly repository: PlayerRecoveryCheckpointRepository,
  ) {}

  private readonly checkpointWriteQueues = new Map<
    PokemonTrainerId,
    Promise<void>
  >();

  async loadRecoveryCheckpoint(
    trainerId: PokemonTrainerId,
  ): Promise<PlayerRecoveryCheckpoint> {
    await this.waitForPendingCheckpointWrite(trainerId);

    const persisted = await this.repository.load(trainerId);

    const fallback = this.getFallbackRecoveryCheckpoint();

    if (!persisted) {
      console.warn(
        '[PlayerRecoveryCheckpoint] Trainer not found; using fallback',
        {
          trainerId,
          fallbackMapId: fallback.mapId,
        },
      );

      return fallback;
    }

    if (this.isUnsetCheckpoint(persisted)) {
      return fallback;
    }

    if (!persisted.mapId || !this.isKnownMapId(persisted.mapId)) {
      await this.repairCheckpointBestEffort(trainerId, fallback, 'invalid-map');

      return fallback;
    }

    if (
      persisted.x === null ||
      persisted.y === null ||
      !this.isValidPosition(persisted.mapId, persisted.x, persisted.y)
    ) {
      await this.repairCheckpointBestEffort(
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

    const checkpoint: PlayerRecoveryCheckpoint = {
      mapId: persisted.mapId,
      x: persisted.x,
      y: persisted.y,
      direction,
    };

    if (direction !== persisted.direction) {
      await this.repairCheckpointBestEffort(
        trainerId,
        checkpoint,
        'invalid-direction',
      );
    }

    return checkpoint;
  }

  async saveRecoveryCheckpoint(
    trainerId: PokemonTrainerId,
    checkpoint: PlayerRecoveryCheckpoint,
  ): Promise<void> {
    this.assertValidCheckpoint(checkpoint);

    await this.enqueueCheckpointSave(trainerId, checkpoint);
  }

  async saveMapSpawnRecoveryCheckpoint(
    trainerId: PokemonTrainerId,
    mapId: MapId,
    direction: Direction = 'up',
  ): Promise<PlayerRecoveryCheckpoint> {
    const mapData = MAP_DATA_REGISTRY[mapId];

    const checkpoint: PlayerRecoveryCheckpoint = {
      mapId,
      x: mapData.spawn.x,
      y: mapData.spawn.y,
      direction,
    };

    await this.saveRecoveryCheckpoint(trainerId, checkpoint);

    return checkpoint;
  }

  /**
   * Recovery point for Trainers that have never registered
   * a Pokémon Center checkpoint. DEFAULT_MAP_ID is currently town-01.
   */
  getFallbackRecoveryCheckpoint(): PlayerRecoveryCheckpoint {
    const mapData = MAP_DATA_REGISTRY[DEFAULT_MAP_ID];

    return {
      mapId: DEFAULT_MAP_ID,
      x: mapData.spawn.x,
      y: mapData.spawn.y,
      direction: 'down',
    };
  }

  private isUnsetCheckpoint(
    checkpoint: PersistedPlayerRecoveryCheckpoint,
  ): boolean {
    return (
      checkpoint.mapId === null &&
      checkpoint.x === null &&
      checkpoint.y === null &&
      checkpoint.direction === null
    );
  }

  private assertValidCheckpoint(checkpoint: PlayerRecoveryCheckpoint): void {
    if (!this.isKnownMapId(checkpoint.mapId)) {
      throw new Error(
        `Cannot persist recovery checkpoint for unknown map "${checkpoint.mapId}"`,
      );
    }

    if (!this.isValidPosition(checkpoint.mapId, checkpoint.x, checkpoint.y)) {
      throw new Error(
        [
          'Cannot persist recovery checkpoint outside map bounds',
          `map="${checkpoint.mapId}"`,
          `x=${checkpoint.x}`,
          `y=${checkpoint.y}`,
        ].join(' '),
      );
    }

    if (!this.isDirection(checkpoint.direction)) {
      throw new Error(
        `Cannot persist recovery checkpoint with invalid direction "${checkpoint.direction}"`,
      );
    }
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

  private enqueueCheckpointSave(
    trainerId: PokemonTrainerId,
    checkpoint: PlayerRecoveryCheckpoint,
  ): Promise<void> {
    const previous =
      this.checkpointWriteQueues.get(trainerId) ?? Promise.resolve();

    const next = previous
      .catch(() => undefined)
      .then(() => this.repository.save(trainerId, checkpoint));

    this.checkpointWriteQueues.set(trainerId, next);

    void next.then(
      () => {
        this.cleanupCheckpointWriteQueue(trainerId, next);
      },
      () => {
        this.cleanupCheckpointWriteQueue(trainerId, next);
      },
    );

    return next;
  }

  private cleanupCheckpointWriteQueue(
    trainerId: PokemonTrainerId,
    write: Promise<void>,
  ): void {
    if (this.checkpointWriteQueues.get(trainerId) === write) {
      this.checkpointWriteQueues.delete(trainerId);
    }
  }

  private async waitForPendingCheckpointWrite(
    trainerId: PokemonTrainerId,
  ): Promise<void> {
    while (true) {
      const pending = this.checkpointWriteQueues.get(trainerId);

      if (!pending) {
        return;
      }

      try {
        await pending;
      } catch (error: unknown) {
        console.warn('[PlayerRecoveryCheckpoint] Pending write failed', {
          trainerId,
          error,
        });
      }

      const current = this.checkpointWriteQueues.get(trainerId);

      if (!current || current === pending) {
        return;
      }
    }
  }

  private async repairCheckpointBestEffort(
    trainerId: PokemonTrainerId,
    checkpoint: PlayerRecoveryCheckpoint,
    reason: string,
  ): Promise<void> {
    try {
      await this.saveRecoveryCheckpoint(trainerId, checkpoint);
    } catch (error: unknown) {
      console.warn('[PlayerRecoveryCheckpoint] Failed to repair checkpoint', {
        trainerId,
        reason,
        error,
      });
    }
  }
}
