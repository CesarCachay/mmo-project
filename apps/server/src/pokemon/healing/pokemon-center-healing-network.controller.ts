import type { Socket } from 'socket.io';

import {
  POKEMON_CENTER_HEALING_EVENTS,
  isPokemonCenterHealInput,
} from '@cesar-mmo/shared';

import type {
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

import { PokemonStorageAccessSessionStore } from '../storage/pokemon-storage-access-session.store';

import { PokemonWildEncounterSessionStore } from '../encounters/pokemon-wild-encounter-session.store';

import { PokemonBattleSessionStore } from '../battles/pokemon-battle-session.store';

import {
  getServerMapHealingStation,
  isPlayerNearMapHealingStation,
} from '../../game/maps/serverMapRegistry';

export interface PokemonCenterHealingNetworkControllerOptions {
  readonly healingService: PokemonCenterHealingService;

  readonly trainerStatePresenter: PokemonTrainerStateNetworkPresenter;

  readonly playerWorldRuntimeStore: PlayerWorldRuntimeStore;

  readonly dialogueSessionStore: {
    has(playerId: string): boolean;
  };

  readonly storageAccessSessionStore: PokemonStorageAccessSessionStore;

  readonly wildEncounterSessionStore: PokemonWildEncounterSessionStore;

  readonly battleSessionStore: PokemonBattleSessionStore;

  readonly resolveTrainerId: (playerId: string) => PokemonTrainerId | undefined;

  /*
   * Inyectables para permitir tests del controller
   * sin depender de un mapa Tiled real.
   */
  readonly getHealingStation?: typeof getServerMapHealingStation;

  readonly isPlayerNearHealingStation?: typeof isPlayerNearMapHealingStation;
}

export class PokemonCenterHealingNetworkController {
  private readonly healingService: PokemonCenterHealingService;

  private readonly trainerStatePresenter: PokemonTrainerStateNetworkPresenter;

  private readonly playerWorldRuntimeStore: PlayerWorldRuntimeStore;

  private readonly dialogueSessionStore: PokemonCenterHealingNetworkControllerOptions['dialogueSessionStore'];

  private readonly storageAccessSessionStore: PokemonStorageAccessSessionStore;

  private readonly wildEncounterSessionStore: PokemonWildEncounterSessionStore;

  private readonly battleSessionStore: PokemonBattleSessionStore;

  private readonly resolveTrainerId: PokemonCenterHealingNetworkControllerOptions['resolveTrainerId'];

  private readonly getHealingStation: typeof getServerMapHealingStation;

  private readonly isPlayerNearHealingStation: typeof isPlayerNearMapHealingStation;

  constructor(options: PokemonCenterHealingNetworkControllerOptions) {
    this.healingService = options.healingService;

    this.trainerStatePresenter = options.trainerStatePresenter;

    this.playerWorldRuntimeStore = options.playerWorldRuntimeStore;

    this.dialogueSessionStore = options.dialogueSessionStore;

    this.storageAccessSessionStore = options.storageAccessSessionStore;

    this.wildEncounterSessionStore = options.wildEncounterSessionStore;

    this.battleSessionStore = options.battleSessionStore;

    this.resolveTrainerId = options.resolveTrainerId;

    this.getHealingStation =
      options.getHealingStation ?? getServerMapHealingStation;

    this.isPlayerNearHealingStation =
      options.isPlayerNearHealingStation ?? isPlayerNearMapHealingStation;
  }

  public async handleHeal(client: Socket, payload: unknown): Promise<void> {
    /*
     * --------------------------------------------------
     * 1. Network contract
     * --------------------------------------------------
     */

    if (!isPokemonCenterHealInput(payload)) {
      this.emitError(client, 'INVALID_INPUT');
      return;
    }

    /*
     * --------------------------------------------------
     * 2. Server-side identity + world authority
     * --------------------------------------------------
     */

    const player = this.playerWorldRuntimeStore.getPlayer(client.id);

    const trainerId = this.resolveTrainerId(client.id);

    if (!player || !trainerId) {
      this.emitError(client, 'HEALING_NOT_AVAILABLE');

      return;
    }

    /*
     * --------------------------------------------------
     * 3. Compatibility guards
     * --------------------------------------------------
     */

    if (this.isHealingBlocked(client.id)) {
      this.emitError(client, 'INCOMPATIBLE_STATE');

      return;
    }

    /*
     * --------------------------------------------------
     * 4. Map + station + proximity authority
     * --------------------------------------------------
     */

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

    /*
     * --------------------------------------------------
     * 5. Authoritative healing
     * --------------------------------------------------
     */

    try {
      const result = await this.healingService.healParty(trainerId);

      /*
       * Owner authoritative state.
       *
       * publishTrainerState también mantiene follower
       * sincronizado aunque HP/PP no modifique su especie.
       */
      this.trainerStatePresenter.publishTrainerState(
        client,
        result.trainerState,
      );

      /* ACK owner-only */
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

  private isHealingBlocked(playerId: string): boolean {
    return (
      this.dialogueSessionStore.has(playerId) ||
      this.storageAccessSessionStore.has(playerId) ||
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
