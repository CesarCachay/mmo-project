import type { Socket } from 'socket.io';

import {
  POKEMON_OVERWORLD_ITEM_EVENTS,
  isPokemonOverworldItemUseInput,
} from '@cesar-mmo/shared';

import type {
  PokemonOverworldItemUsedPayload,
  PokemonOverworldItemErrorPayload,
} from '@cesar-mmo/shared';

import type { PokemonTrainerId } from '../pokemon-trainer-identity';

import {
  PokemonOverworldItemService,
  PokemonOverworldItemUseError,
} from './pokemon-overworld-item.service';

import { PokemonTrainerStateNetworkPresenter } from '../network/PokemonTrainerStateNetworkPresenter';

import { PokemonStorageAccessSessionStore } from '../storage/pokemon-storage-access-session.store';
import { PokemonShopAccessSessionStore } from '../economy/shop/pokemon-shop-access-session.store';

import { PokemonWildEncounterSessionStore } from '../encounters/pokemon-wild-encounter-session.store';

import { PokemonBattleSessionStore } from '../battles/pokemon-battle-session.store';

export interface PokemonOverworldItemNetworkControllerOptions {
  readonly overworldItemService: PokemonOverworldItemService;
  readonly trainerStatePresenter: PokemonTrainerStateNetworkPresenter;
  readonly dialogueSessionStore: {
    has(playerId: string): boolean;
  };
  readonly storageAccessSessionStore: PokemonStorageAccessSessionStore;
  readonly shopAccessSessionStore: PokemonShopAccessSessionStore;
  readonly wildEncounterSessionStore: PokemonWildEncounterSessionStore;
  readonly battleSessionStore: PokemonBattleSessionStore;
  readonly resolveTrainerId: (playerId: string) => PokemonTrainerId | undefined;
}

export class PokemonOverworldItemNetworkController {
  private readonly overworldItemService: PokemonOverworldItemService;
  private readonly trainerStatePresenter: PokemonTrainerStateNetworkPresenter;
  private readonly dialogueSessionStore: PokemonOverworldItemNetworkControllerOptions['dialogueSessionStore'];
  private readonly storageAccessSessionStore: PokemonStorageAccessSessionStore;
  private readonly shopAccessSessionStore: PokemonShopAccessSessionStore;
  private readonly wildEncounterSessionStore: PokemonWildEncounterSessionStore;
  private readonly battleSessionStore: PokemonBattleSessionStore;
  private readonly resolveTrainerId: PokemonOverworldItemNetworkControllerOptions['resolveTrainerId'];

  constructor(options: PokemonOverworldItemNetworkControllerOptions) {
    this.overworldItemService = options.overworldItemService;
    this.trainerStatePresenter = options.trainerStatePresenter;
    this.dialogueSessionStore = options.dialogueSessionStore;
    this.storageAccessSessionStore = options.storageAccessSessionStore;
    this.shopAccessSessionStore = options.shopAccessSessionStore;
    this.wildEncounterSessionStore = options.wildEncounterSessionStore;
    this.battleSessionStore = options.battleSessionStore;
    this.resolveTrainerId = options.resolveTrainerId;
  }

  public async handleUse(client: Socket, payload: unknown): Promise<void> {
    if (!isPokemonOverworldItemUseInput(payload)) {
      this.emitError(client, 'INVALID_INPUT');
      return;
    }

    /* Identidad siempre derivada desde el socket */
    const trainerId = this.resolveTrainerId(client.id);

    if (!trainerId) {
      this.emitError(client, 'INCOMPATIBLE_STATE');
      return;
    }

    /* Preservamos exactamente los compatibility guards actuales */
    if (this.isItemUseBlocked(client.id)) {
      this.emitError(client, 'INCOMPATIBLE_STATE');

      return;
    }

    try {
      /* Service conserva toda la autoridad gameplay */
      const result = await this.overworldItemService.useItem({
        trainerId,
        itemId: payload.itemId,
        targetPokemonInstanceId: payload.targetPokemonInstanceId,
      });

      /* Un healing item no cambia party[0] */
      this.trainerStatePresenter.emitTrainerState(client, result.trainerState);

      /* ACK owner-only */
      client.emit(POKEMON_OVERWORLD_ITEM_EVENTS.USED, {
        itemId: result.itemId,
        targetPokemonInstanceId: result.targetPokemonInstanceId,
        previousHp: result.previousHp,
        currentHp: result.currentHp,
        appliedHealing: result.appliedHealing,
      } satisfies PokemonOverworldItemUsedPayload);
    } catch (error: unknown) {
      if (error instanceof PokemonOverworldItemUseError) {
        this.emitError(client, error.code);
        return;
      }

      console.error('[PokemonOverworldItem] unexpected failure', {
        playerId: client.id,
        trainerId,
        itemId: payload.itemId,
        targetPokemonInstanceId: payload.targetPokemonInstanceId,
        error,
      });

      this.emitError(client, 'PERSISTENCE_FAILED');
    }
  }

  private isItemUseBlocked(playerId: string): boolean {
    return (
      this.dialogueSessionStore.has(playerId) ||
      this.storageAccessSessionStore.has(playerId) ||
      this.shopAccessSessionStore.has(playerId) ||
      this.wildEncounterSessionStore.has(playerId) ||
      Boolean(this.battleSessionStore.getByPlayerId(playerId))
    );
  }

  private emitError(
    client: Socket,
    code: PokemonOverworldItemErrorPayload['code'],
  ): void {
    client.emit(POKEMON_OVERWORLD_ITEM_EVENTS.ERROR, {
      code,
    } satisfies PokemonOverworldItemErrorPayload);
  }
}
