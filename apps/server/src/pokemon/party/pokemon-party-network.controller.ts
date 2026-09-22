import type { Socket } from 'socket.io';

import {
  POKEMON_EVENTS,
  POKEMON_PARTY_REORDER_EVENTS,
  isPokemonStarterChoiceInput,
  isPokemonPartyReorderInput,
} from '@cesar-mmo/shared';

import type {
  PokemonPartyReorderedPayload,
  PokemonStarterSelectedPayload,
  PokemonPartyReorderErrorPayload,
} from '@cesar-mmo/shared';

import {
  PokemonPartyReorderError,
  PokemonTrainerService,
} from '../pokemon-trainer.service';

import { PokemonTrainerStateStore } from '../pokemon-trainer-state.store';

import type { PokemonTrainerId } from '../pokemon-trainer-identity';

import { PokemonStorageAccessSessionStore } from '../storage/pokemon-storage-access-session.store';
import { PokemonShopAccessSessionStore } from '../economy/shop/pokemon-shop-access-session.store';

import { PokemonWildEncounterSessionStore } from '../encounters/pokemon-wild-encounter-session.store';

import { PokemonBattleSessionStore } from '../battles/pokemon-battle-session.store';

import { PlayerWorldRuntimeStore } from '../../game/world/player-world-runtime.store';

import { PokemonTrainerStateNetworkPresenter } from '../network/PokemonTrainerStateNetworkPresenter';

import {
  getServerMapNpc,
  isPlayerNearMapNpc,
} from '../../game/maps/serverMapRegistry';

export interface PokemonPartyNetworkControllerOptions {
  readonly trainerService: PokemonTrainerService;
  readonly trainerStateStore: PokemonTrainerStateStore;
  readonly playerWorldRuntimeStore: PlayerWorldRuntimeStore;
  readonly dialogueSessionStore: {
    has(playerId: string): boolean;
  };
  readonly storageAccessSessionStore: PokemonStorageAccessSessionStore;
  readonly shopAccessSessionStore: PokemonShopAccessSessionStore;
  readonly wildEncounterSessionStore: PokemonWildEncounterSessionStore;
  readonly battleSessionStore: PokemonBattleSessionStore;
  readonly resolveTrainerId: (playerId: string) => PokemonTrainerId | undefined;
  readonly trainerStatePresenter: PokemonTrainerStateNetworkPresenter;
}

export class PokemonPartyNetworkController {
  private readonly trainerService: PokemonTrainerService;
  private readonly trainerStateStore: PokemonTrainerStateStore;
  private readonly playerWorldRuntimeStore: PlayerWorldRuntimeStore;
  private readonly dialogueSessionStore: PokemonPartyNetworkControllerOptions['dialogueSessionStore'];
  private readonly storageAccessSessionStore: PokemonStorageAccessSessionStore;
  private readonly shopAccessSessionStore: PokemonShopAccessSessionStore;
  private readonly wildEncounterSessionStore: PokemonWildEncounterSessionStore;
  private readonly battleSessionStore: PokemonBattleSessionStore;
  private readonly resolveTrainerId: PokemonPartyNetworkControllerOptions['resolveTrainerId'];
  private readonly trainerStatePresenter: PokemonTrainerStateNetworkPresenter;

  constructor(options: PokemonPartyNetworkControllerOptions) {
    this.trainerService = options.trainerService;
    this.trainerStateStore = options.trainerStateStore;
    this.playerWorldRuntimeStore = options.playerWorldRuntimeStore;
    this.dialogueSessionStore = options.dialogueSessionStore;
    this.storageAccessSessionStore = options.storageAccessSessionStore;
    this.shopAccessSessionStore = options.shopAccessSessionStore;
    this.wildEncounterSessionStore = options.wildEncounterSessionStore;
    this.battleSessionStore = options.battleSessionStore;
    this.resolveTrainerId = options.resolveTrainerId;
    this.trainerStatePresenter = options.trainerStatePresenter;
  }

  public async handleChooseStarter(
    client: Socket,
    payload: unknown,
  ): Promise<void> {
    if (!isPokemonStarterChoiceInput(payload)) {
      return;
    }

    const player = this.playerWorldRuntimeStore.getPlayer(client.id);

    if (!player) {
      return;
    }

    const trainerId = this.resolveTrainerId(client.id);

    if (!trainerId) {
      return;
    }

    const starterNpc = getServerMapNpc(player.mapId, 'professorOak');

    if (!starterNpc || !isPlayerNearMapNpc(player.x, player.y, starterNpc)) {
      this.trainerStateStore.lockStarterSelection(trainerId);

      return;
    }

    try {
      const result = await this.trainerService.chooseStarter(
        trainerId,
        payload.starterId,
      );
      this.trainerStatePresenter.publishTrainerState(
        client,
        result.trainerState,
      );
      client.emit(POKEMON_EVENTS.STARTER_SELECTED, {
        starterId: payload.starterId,
        rewardItems: result.rewardItems.map((item) => ({ ...item })),
      } satisfies PokemonStarterSelectedPayload);
    } catch (error: unknown) {
      console.warn(
        `[PokemonParty] Starter selection rejected for player ${client.id}`,
        error,
      );

      const trainerState = this.trainerStateStore.get(trainerId);

      if (!trainerState) {
        return;
      }

      this.trainerStatePresenter.emitTrainerState(client, trainerState);
    }
  }

  public async handleReorder(client: Socket, payload: unknown): Promise<void> {
    if (!isPokemonPartyReorderInput(payload)) {
      this.emitReorderError(client, 'INVALID_INPUT');

      return;
    }

    const trainerId = this.resolveTrainerId(client.id);

    if (!trainerId) {
      this.emitReorderError(client, 'INCOMPATIBLE_STATE');

      return;
    }

    if (this.isPartyMutationBlocked(client.id)) {
      this.emitReorderError(client, 'INCOMPATIBLE_STATE');

      return;
    }

    try {
      const trainerState = await this.trainerService.reorderParty(
        trainerId,
        payload.pokemonInstanceId,
        payload.targetPosition,
      );
      this.trainerStatePresenter.publishTrainerState(client, trainerState);
      /* ACK después */
      client.emit(POKEMON_PARTY_REORDER_EVENTS.REORDERED, {
        pokemonInstanceId: payload.pokemonInstanceId,

        targetPosition: payload.targetPosition,
      } satisfies PokemonPartyReorderedPayload);
    } catch (error: unknown) {
      if (error instanceof PokemonPartyReorderError) {
        this.emitReorderError(client, error.code);
        return;
      }

      console.error('[PokemonParty] Reorder persistence failure', {
        playerId: client.id,
        trainerId,
        pokemonInstanceId: payload.pokemonInstanceId,
        targetPosition: payload.targetPosition,
        error,
      });
      this.emitReorderError(client, 'PERSISTENCE_FAILED');
    }
  }

  private isPartyMutationBlocked(playerId: string): boolean {
    return (
      this.dialogueSessionStore.has(playerId) ||
      this.storageAccessSessionStore.has(playerId) ||
      this.shopAccessSessionStore.has(playerId) ||
      this.wildEncounterSessionStore.has(playerId) ||
      Boolean(this.battleSessionStore.getByPlayerId(playerId))
    );
  }

  private emitReorderError(
    client: Socket,
    code: PokemonPartyReorderErrorPayload['code'],
  ): void {
    client.emit(POKEMON_PARTY_REORDER_EVENTS.ERROR, {
      code,
    } satisfies PokemonPartyReorderErrorPayload);
  }
}
