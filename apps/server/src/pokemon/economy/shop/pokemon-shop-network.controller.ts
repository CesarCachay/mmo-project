import type { Socket } from 'socket.io';
import {
  POKEMON_SHOP_EVENTS,
  getPokemonShopCatalog,
  isPokemonShopBuyInput,
  isPokemonShopCloseInput,
  isPokemonShopOpenInput,
  isPokemonShopSellInput,
  type PokemonShopClosedPayload,
  type PokemonShopErrorPayload,
  type PokemonShopOpenedPayload,
  type PokemonShopPurchasedPayload,
  type PokemonShopSoldPayload,
} from '@cesar-mmo/shared';

import type { PlayerWorldRuntimeStore } from '#app/game/world/player-world-runtime.store';
import type { DialogueSessionStore } from '#app/dialogue/dialogue-session.store';
import type { PokemonStorageAccessSessionStore } from '#app/pokemon/storage/pokemon-storage-access-session.store';
import type { PokemonWildEncounterSessionStore } from '#app/pokemon/encounters/pokemon-wild-encounter-session.store';
import type { PokemonBattleSessionStore } from '#app/pokemon/battles/pokemon-battle-session.store';
import type { PokemonTrainerStateStore } from '#app/pokemon/pokemon-trainer-state.store';
import type { PokemonTrainerStateNetworkPresenter } from '#app/pokemon/network/PokemonTrainerStateNetworkPresenter';
import type { PokemonTrainerId } from '#app/pokemon/pokemon-trainer-identity';
import {
  getServerMapNpc,
  isPlayerNearMapNpc,
} from '#app/game/maps/serverMapRegistry';

import { PokemonShopAccessSessionStore } from './pokemon-shop-access-session.store';
import type { PokemonShopPurchaseOperationQueue } from './pokemon-shop-purchase-operation.queue';
import {
  PokemonShopPurchaseError,
  type PokemonShopPurchaseService,
} from './pokemon-shop-purchase.service';
import {
  PokemonShopSaleError,
  type PokemonShopSaleService,
} from './pokemon-shop-sale.service';

export interface PokemonShopNetworkControllerOptions {
  readonly accessSessionStore: PokemonShopAccessSessionStore;
  readonly purchaseService: PokemonShopPurchaseService;
  readonly operationQueue: PokemonShopPurchaseOperationQueue;
  readonly saleService: PokemonShopSaleService;
  readonly trainerStateStore: PokemonTrainerStateStore;
  readonly trainerStatePresenter: PokemonTrainerStateNetworkPresenter;
  readonly playerWorldRuntimeStore: PlayerWorldRuntimeStore;
  readonly dialogueSessionStore: DialogueSessionStore;
  readonly storageAccessSessionStore: PokemonStorageAccessSessionStore;
  readonly wildEncounterSessionStore: PokemonWildEncounterSessionStore;
  readonly battleSessionStore: PokemonBattleSessionStore;
  readonly resolveTrainerId: (playerId: string) => PokemonTrainerId | undefined;
}

export class PokemonShopNetworkController {
  private readonly transactionInFlightByPlayerId = new Set<string>();
  constructor(
    private readonly options: PokemonShopNetworkControllerOptions,
  ) {}

  async handleOpen(client: Socket, payload: unknown): Promise<void> {
    if (!isPokemonShopOpenInput(payload)) {
      this.emitError(client, 'INVALID_INPUT', 'Invalid shop open request.');
      return;
    }

    const initialPlayer = this.options.playerWorldRuntimeStore.getPlayer(client.id);
    const initialTrainerId = this.options.resolveTrainerId(client.id);

    if (!initialPlayer || !initialTrainerId) {
      this.emitError(
        client,
        'SHOP_NOT_AVAILABLE',
        'The shop is not available right now.',
      );
      return;
    }

    if (this.hasIncompatibleRuntimeState(client.id)) {
      this.emitError(
        client,
        'INCOMPATIBLE_STATE',
        'Close the current activity before opening the shop.',
      );
      return;
    }

    const npcId = payload.npcId.trim();
    const initialNpc = getServerMapNpc(initialPlayer.mapId, npcId);

    if (
      !initialNpc ||
      !initialNpc.shopCatalogId ||
      !isPlayerNearMapNpc(initialPlayer.x, initialPlayer.y, initialNpc)
    ) {
      this.emitError(
        client,
        'SHOP_NOT_AVAILABLE',
        'Move closer to the shop clerk and try again.',
      );
      return;
    }

    getPokemonShopCatalog(initialNpc.shopCatalogId);

    /*
     * A reconnect can race an economy mutation that began on the old socket.
     * Wait until that Trainer's shop queue is idle, then re-resolve all world
     * authority before exposing wallet/inventory to the newly opened panel.
     */
    await this.options.operationQueue.waitForIdle(initialTrainerId);

    const player = this.options.playerWorldRuntimeStore.getPlayer(client.id);
    const trainerId = this.options.resolveTrainerId(client.id);

    if (!player || !trainerId || trainerId !== initialTrainerId) {
      this.emitError(
        client,
        'SHOP_NOT_AVAILABLE',
        'The shop is not available right now.',
      );
      return;
    }

    if (this.hasIncompatibleRuntimeState(client.id)) {
      this.emitError(
        client,
        'INCOMPATIBLE_STATE',
        'Close the current activity before opening the shop.',
      );
      return;
    }

    const npc = getServerMapNpc(player.mapId, npcId);

    if (
      !npc ||
      !npc.shopCatalogId ||
      !isPlayerNearMapNpc(player.x, player.y, npc)
    ) {
      this.emitError(
        client,
        'SHOP_NOT_AVAILABLE',
        'Move closer to the shop clerk and try again.',
      );
      return;
    }

    const trainerState = this.options.trainerStateStore.get(trainerId);

    if (!trainerState) {
      this.emitError(
        client,
        'TRAINER_STATE_NOT_FOUND',
        'Trainer state is not available.',
      );
      return;
    }

    getPokemonShopCatalog(npc.shopCatalogId);

    try {
      const session = this.options.accessSessionStore.start({
        playerId: client.id,
        mapId: player.mapId,
        npcId,
        catalogId: npc.shopCatalogId,
      });

      this.stopPlayerMovement(client.id);

      client.emit(POKEMON_SHOP_EVENTS.OPENED, {
        sessionId: session.sessionId,
        npcId: session.npcId,
        catalogId: session.catalogId,
        money: trainerState.money,
        inventory: trainerState.inventory,
      } satisfies PokemonShopOpenedPayload);
    } catch {
      this.emitError(
        client,
        'INCOMPATIBLE_STATE',
        'Another shop session is already active.',
      );
    }
  }

  async handleBuy(client: Socket, payload: unknown): Promise<void> {
    if (!isPokemonShopBuyInput(payload)) {
      this.emitError(client, 'INVALID_INPUT', 'Invalid shop purchase request.');
      return;
    }

    const session = this.options.accessSessionStore.get(client.id);

    if (!session || session.sessionId !== payload.sessionId.trim()) {
      this.emitError(
        client,
        'SESSION_MISMATCH',
        'The shop session is no longer active.',
      );
      return;
    }

    const requestId = payload.requestId.trim();

    if (this.transactionInFlightByPlayerId.has(client.id)) {
      this.emitError(
        client,
        'PURCHASE_IN_PROGRESS',
        'Wait for the current shop transaction to finish.',
      );
      return;
    }

    const context = this.resolveTransactionContext(client, session);

    if (!context) {
      this.invalidateSession(client);
      this.emitError(
        client,
        'SHOP_NOT_AVAILABLE',
        'The Poké Shop session is no longer valid.',
      );
      return;
    }

    this.transactionInFlightByPlayerId.add(client.id);

    try {
      const result = await this.options.purchaseService.purchase({
        trainerId: context.trainerId,
        requestId,
        catalogId: session.catalogId,
        itemId: payload.itemId,
        quantity: payload.quantity,
      });

      const activeSession = this.options.accessSessionStore.get(client.id);

      if (!activeSession || activeSession.sessionId !== session.sessionId) {
        return;
      }

      const purchasedPayload: PokemonShopPurchasedPayload = {
        sessionId: session.sessionId,
        requestId,
        itemId: result.quote.itemId,
        quantity: result.quote.quantity,
        unitPrice: result.quote.unitPrice,
        totalPrice: result.quote.totalPrice,
        money: result.trainerState.money,
        inventoryQuantity: result.inventoryQuantity,
      };

      this.options.trainerStatePresenter.publishTrainerState(
        client,
        result.trainerState,
      );
      client.emit(POKEMON_SHOP_EVENTS.PURCHASED, purchasedPayload);
    } catch (error: unknown) {
      if (error instanceof PokemonShopPurchaseError) {
        switch (error.code) {
          case 'TRAINER_STATE_NOT_FOUND':
            this.emitError(client, 'TRAINER_STATE_NOT_FOUND', error.message);
            return;
          case 'ITEM_NOT_AVAILABLE':
            this.emitError(client, 'ITEM_NOT_AVAILABLE', error.message);
            return;
          case 'INSUFFICIENT_FUNDS':
            this.emitError(client, 'INSUFFICIENT_FUNDS', error.message);
            return;
          case 'REQUEST_CONFLICT':
            this.emitError(client, 'INVALID_INPUT', error.message);
            return;
          case 'PERSISTENCE_FAILED':
            this.emitError(client, 'PURCHASE_FAILED', error.message);
            return;
        }
      }

      console.error('[PokemonShop] unexpected purchase error', {
        playerId: client.id,
        error,
      });
      this.emitError(
        client,
        'PURCHASE_FAILED',
        'The purchase could not be completed.',
      );
    } finally {
      this.transactionInFlightByPlayerId.delete(client.id);
    }
  }

  async handleSell(client: Socket, payload: unknown): Promise<void> {
    if (!isPokemonShopSellInput(payload)) {
      this.emitError(client, 'INVALID_INPUT', 'Invalid shop sale request.');
      return;
    }

    const session = this.options.accessSessionStore.get(client.id);

    if (!session || session.sessionId !== payload.sessionId.trim()) {
      this.emitError(
        client,
        'SESSION_MISMATCH',
        'The shop session is no longer active.',
      );
      return;
    }

    const requestId = payload.requestId.trim();

    if (this.transactionInFlightByPlayerId.has(client.id)) {
      this.emitError(
        client,
        'SALE_IN_PROGRESS',
        'Wait for the current shop transaction to finish.',
      );
      return;
    }

    const context = this.resolveTransactionContext(client, session);

    if (!context) {
      this.invalidateSession(client);
      this.emitError(
        client,
        'SHOP_NOT_AVAILABLE',
        'The Poké Shop session is no longer valid.',
      );
      return;
    }

    this.transactionInFlightByPlayerId.add(client.id);

    try {
      const result = await this.options.saleService.sell({
        trainerId: context.trainerId,
        requestId,
        catalogId: session.catalogId,
        itemId: payload.itemId,
        quantity: payload.quantity,
      });

      const activeSession = this.options.accessSessionStore.get(client.id);

      if (!activeSession || activeSession.sessionId !== session.sessionId) {
        return;
      }

      const soldPayload: PokemonShopSoldPayload = {
        sessionId: session.sessionId,
        requestId,
        itemId: result.quote.itemId,
        quantity: result.quote.quantity,
        unitPrice: result.quote.unitPrice,
        totalPrice: result.quote.totalPrice,
        money: result.trainerState.money,
        inventoryQuantity: result.inventoryQuantity,
      };

      this.options.trainerStatePresenter.publishTrainerState(
        client,
        result.trainerState,
      );
      client.emit(POKEMON_SHOP_EVENTS.SOLD, soldPayload);
    } catch (error: unknown) {
      if (error instanceof PokemonShopSaleError) {
        switch (error.code) {
          case 'TRAINER_STATE_NOT_FOUND':
            this.emitError(client, 'TRAINER_STATE_NOT_FOUND', error.message);
            return;
          case 'ITEM_NOT_SELLABLE':
            this.emitError(client, 'ITEM_NOT_SELLABLE', error.message);
            return;
          case 'INSUFFICIENT_INVENTORY':
            this.emitError(client, 'INSUFFICIENT_INVENTORY', error.message);
            return;
          case 'WALLET_LIMIT_REACHED':
            this.emitError(client, 'WALLET_LIMIT_REACHED', error.message);
            return;
          case 'REQUEST_CONFLICT':
            this.emitError(client, 'INVALID_INPUT', error.message);
            return;
          case 'PERSISTENCE_FAILED':
            this.emitError(client, 'SALE_FAILED', error.message);
            return;
        }
      }

      console.error('[PokemonShop] unexpected sale error', {
        playerId: client.id,
        error,
      });
      this.emitError(client, 'SALE_FAILED', 'The sale could not be completed.');
    } finally {
      this.transactionInFlightByPlayerId.delete(client.id);
    }
  }

  handleClose(client: Socket, payload: unknown): void {
    if (!isPokemonShopCloseInput(payload)) {
      this.emitError(client, 'INVALID_INPUT', 'Invalid shop close request.');
      return;
    }

    if (this.transactionInFlightByPlayerId.has(client.id)) {
      this.emitError(
        client,
        'TRANSACTION_IN_PROGRESS',
        'Wait for the current shop transaction to finish before closing.',
      );
      return;
    }

    const session = this.options.accessSessionStore.get(client.id);

    if (!session || session.sessionId !== payload.sessionId.trim()) {
      this.emitError(
        client,
        'SESSION_MISMATCH',
        'The shop session is no longer active.',
      );
      return;
    }

    this.options.accessSessionStore.remove(client.id);
    this.cleanupSessionRuntime(client.id);

    client.emit(POKEMON_SHOP_EVENTS.CLOSED, {
      sessionId: session.sessionId,
      reason: 'client-request',
    } satisfies PokemonShopClosedPayload);
  }

  closeForRuntimeReason(
    client: Socket,
    reason: PokemonShopClosedPayload['reason'],
  ): void {
    const session = this.options.accessSessionStore.remove(client.id);

    if (!session) {
      return;
    }

    this.cleanupSessionRuntime(client.id);

    client.emit(POKEMON_SHOP_EVENTS.CLOSED, {
      sessionId: session.sessionId,
      reason,
    } satisfies PokemonShopClosedPayload);
  }

  private resolveTransactionContext(
    client: Socket,
    session: {
      readonly mapId: string;
      readonly npcId: string;
      readonly catalogId: string;
    },
  ): { readonly trainerId: PokemonTrainerId } | undefined {
    const player = this.options.playerWorldRuntimeStore.getPlayer(client.id);
    const trainerId = this.options.resolveTrainerId(client.id);
    const npc = player
      ? getServerMapNpc(player.mapId, session.npcId)
      : undefined;

    if (
      !player ||
      !trainerId ||
      player.mapId !== session.mapId ||
      !npc ||
      npc.shopCatalogId !== session.catalogId ||
      !isPlayerNearMapNpc(player.x, player.y, npc)
    ) {
      return undefined;
    }

    return { trainerId };
  }

  private invalidateSession(client: Socket): void {
    const session = this.options.accessSessionStore.remove(client.id);
    if (!session) {
      return;
    }

    this.cleanupSessionRuntime(client.id);

    client.emit(POKEMON_SHOP_EVENTS.CLOSED, {
      sessionId: session.sessionId,
      reason: 'invalidated',
    } satisfies PokemonShopClosedPayload);
  }

  private cleanupSessionRuntime(playerId: string): void {
    this.transactionInFlightByPlayerId.delete(playerId);
  }

  private hasIncompatibleRuntimeState(playerId: string): boolean {
    return Boolean(
      this.options.dialogueSessionStore.has(playerId) ||
        this.options.storageAccessSessionStore.has(playerId) ||
        this.options.wildEncounterSessionStore.has(playerId) ||
        this.options.battleSessionStore.hasPlayerBattle(playerId),
    );
  }

  private stopPlayerMovement(playerId: string): void {
    const player = this.options.playerWorldRuntimeStore.getPlayer(playerId);

    if (!player) {
      return;
    }

    player.isMoving = false;

    this.options.playerWorldRuntimeStore.setInput(playerId, {
      sequence: player.lastProcessedInputSequence,
      up: false,
      down: false,
      left: false,
      right: false,
    });
  }

  private emitError(
    client: Socket,
    code: PokemonShopErrorPayload['code'],
    message: string,
  ): void {
    client.emit(POKEMON_SHOP_EVENTS.ERROR, {
      code,
      message,
    } satisfies PokemonShopErrorPayload);
  }
}
