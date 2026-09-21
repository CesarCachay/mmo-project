import type { Socket } from 'socket.io';

import {
  POKEMON_CENTER_HEALING_EVENTS,
  isPokemonCenterHealInput,
} from '@cesar-mmo/shared';

import type {
  MapId,
  PokemonCenterHealedPayload,
  PokemonCenterHealingErrorPayload,
} from '@cesar-mmo/shared';

import type { PokemonTrainerId } from '../pokemon-trainer-identity';

import {
  PokemonCenterHealingError,
  PokemonCenterHealingService,
} from './pokemon-center-healing.service';

import { PokemonTrainerStateNetworkPresenter } from '../network/PokemonTrainerStateNetworkPresenter';

import { PlayerWorldRuntimeStore } from '../../game/world/player-world-runtime.store';

import { PlayerRecoveryCheckpointService } from '../../game/world/player-recovery-checkpoint.service';

import { PokemonStorageAccessSessionStore } from '../storage/pokemon-storage-access-session.store';
import { PokemonShopAccessSessionStore } from '../economy/shop/pokemon-shop-access-session.store';

import { PokemonWildEncounterSessionStore } from '../encounters/pokemon-wild-encounter-session.store';

import { PokemonBattleSessionStore } from '../battles/pokemon-battle-session.store';

import {
  getServerMapHealingStation,
  isPlayerNearMapHealingStation,
} from '../../game/maps/serverMapRegistry';

export interface PokemonCenterHealingNetworkControllerOptions {
  readonly healingService: PokemonCenterHealingService;
  readonly recoveryCheckpointService: PlayerRecoveryCheckpointService;
  readonly trainerStatePresenter: PokemonTrainerStateNetworkPresenter;
  readonly playerWorldRuntimeStore: PlayerWorldRuntimeStore;
  readonly dialogueSessionStore: {
    has(playerId: string): boolean;
  };
  readonly storageAccessSessionStore: PokemonStorageAccessSessionStore;
  readonly shopAccessSessionStore: PokemonShopAccessSessionStore;
  readonly wildEncounterSessionStore: PokemonWildEncounterSessionStore;
  readonly battleSessionStore: PokemonBattleSessionStore;
  readonly resolveTrainerId: (playerId: string) => PokemonTrainerId | undefined;
  readonly getHealingStation?: typeof getServerMapHealingStation;
  readonly isPlayerNearHealingStation?: typeof isPlayerNearMapHealingStation;
}

export class PokemonCenterHealingNetworkController {
  private readonly healingService: PokemonCenterHealingService;
  private readonly recoveryCheckpointService: PlayerRecoveryCheckpointService;
  private readonly trainerStatePresenter: PokemonTrainerStateNetworkPresenter;
  private readonly playerWorldRuntimeStore: PlayerWorldRuntimeStore;
  private readonly dialogueSessionStore: PokemonCenterHealingNetworkControllerOptions['dialogueSessionStore'];
  private readonly storageAccessSessionStore: PokemonStorageAccessSessionStore;
  private readonly shopAccessSessionStore: PokemonShopAccessSessionStore;
  private readonly wildEncounterSessionStore: PokemonWildEncounterSessionStore;
  private readonly battleSessionStore: PokemonBattleSessionStore;
  private readonly resolveTrainerId: PokemonCenterHealingNetworkControllerOptions['resolveTrainerId'];
  private readonly getHealingStation: typeof getServerMapHealingStation;
  private readonly isPlayerNearHealingStation: typeof isPlayerNearMapHealingStation;

  constructor(options: PokemonCenterHealingNetworkControllerOptions) {
    this.healingService = options.healingService;
    this.recoveryCheckpointService = options.recoveryCheckpointService;
    this.trainerStatePresenter = options.trainerStatePresenter;
    this.playerWorldRuntimeStore = options.playerWorldRuntimeStore;
    this.dialogueSessionStore = options.dialogueSessionStore;
    this.storageAccessSessionStore = options.storageAccessSessionStore;
    this.shopAccessSessionStore = options.shopAccessSessionStore;
    this.wildEncounterSessionStore = options.wildEncounterSessionStore;
    this.battleSessionStore = options.battleSessionStore;
    this.resolveTrainerId = options.resolveTrainerId;
    this.getHealingStation =
      options.getHealingStation ?? getServerMapHealingStation;
    this.isPlayerNearHealingStation =
      options.isPlayerNearHealingStation ?? isPlayerNearMapHealingStation;
  }

  public async handleHeal(client: Socket, payload: unknown): Promise<void> {
    /* 1. Network contract */

    if (!isPokemonCenterHealInput(payload)) {
      this.emitError(client, 'INVALID_INPUT');

      return;
    }

    /* 2. Server-side identity + world authority */

    const player = this.playerWorldRuntimeStore.getPlayer(client.id);

    const trainerId = this.resolveTrainerId(client.id);

    if (!player || !trainerId) {
      this.emitError(client, 'HEALING_NOT_AVAILABLE');

      return;
    }

    /* 3. Compatibility guards */

    if (this.isHealingBlocked(client.id)) {
      this.emitError(client, 'INCOMPATIBLE_STATE');

      return;
    }

    /* 4. Map + station + proximity authority */

    const station = this.getHealingStation(
      player.mapId,
      payload.healingStationId,
    );

    if (
      !station ||
      !this.isPlayerNearHealingStation(player.x, player.y, station)
    ) {
      this.emitError(client, 'HEALING_NOT_AVAILABLE');

      return;
    }

    /* 5. Authoritative healing */

    try {
      const result = await this.healingService.healParty(trainerId);

      /*
       * 6. Recovery checkpoint
       *
       * Sólo llegamos aquí después de un healing
       * exitoso.
       *
       * Incluso si restoredPokemonCount === 0,
       * utilizar correctamente el Pokémon Center
       * establece este lugar como nuevo safe point.
       *
       * El checkpoint usa el spawn canónico del mapa,
       * NO la posición de la healing station.
       */

      await this.saveRecoveryCheckpointBestEffort(trainerId, player.mapId);

      /* 7. Owner authoritative state */
      this.trainerStatePresenter.publishTrainerState(
        client,
        result.trainerState,
      );

      /* 8. ACK owner-only */
      client.emit(POKEMON_CENTER_HEALING_EVENTS.HEALED, {
        healingStationId: payload.healingStationId.trim(),
        restoredPokemonCount: result.restoredPokemonCount,
        totalHpRestored: result.totalHpRestored,
        totalPpRestored: result.totalPpRestored,
      } satisfies PokemonCenterHealedPayload);
    } catch (error: unknown) {
      if (error instanceof PokemonCenterHealingError) {
        this.handleHealingError(client, error);

        return;
      }

      console.error('[PokemonCenterHealing] unexpected network failure', {
        playerId: client.id,
        trainerId,
        healingStationId: payload.healingStationId,
        error,
      });

      this.emitError(client, 'PERSISTENCE_FAILED');
    }
  }

  private async saveRecoveryCheckpointBestEffort(
    trainerId: PokemonTrainerId,
    mapId: MapId,
  ): Promise<void> {
    try {
      await this.recoveryCheckpointService.saveMapSpawnRecoveryCheckpoint(
        trainerId,
        mapId,
        'up',
      );
    } catch (error: unknown) {
      /*
       * Healing ya hizo COMMIT.
       *
       * No convertimos un healing exitoso en un
       * falso error solamente porque falló la escritura
       * secundaria del recovery checkpoint.
       *
       * El Trainer conserva su checkpoint anterior o,
       * si nunca tuvo uno, town-01 continúa siendo
       * el fallback seguro.
       */

      console.error(
        '[PokemonCenterHealing] recovery checkpoint persistence failed',
        {
          trainerId,
          mapId,
          error,
        },
      );
    }
  }

  private isHealingBlocked(playerId: string): boolean {
    return (
      this.dialogueSessionStore.has(playerId) ||
      this.storageAccessSessionStore.has(playerId) ||
      this.shopAccessSessionStore.has(playerId) ||
      this.wildEncounterSessionStore.has(playerId) ||
      Boolean(this.battleSessionStore.getByPlayerId(playerId))
    );
  }

  private handleHealingError(
    client: Socket,
    error: PokemonCenterHealingError,
  ): void {
    switch (error.code) {
      case 'TRAINER_STATE_NOT_FOUND':
        this.emitError(client, 'INCOMPATIBLE_STATE');
        return;

      case 'PERSISTENCE_CONFLICT':
        this.emitError(client, 'PERSISTENCE_CONFLICT');
        return;

      case 'PERSISTENCE_FAILED':
        this.emitError(client, 'PERSISTENCE_FAILED');
        return;
    }
  }

  private emitError(
    client: Socket,
    code: PokemonCenterHealingErrorPayload['code'],
  ): void {
    client.emit(POKEMON_CENTER_HEALING_EVENTS.ERROR, {
      code,
    } satisfies PokemonCenterHealingErrorPayload);
  }
}
