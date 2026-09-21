import { io, type Socket } from "socket.io-client";

import {
  CHAT_EVENTS,
  MAP_EVENTS,
  POKEMON_EVENTS,
  DIALOGUE_EVENTS,
  isPokemonWildEncounterStartedPayload,
  isPokemonBattleStartedPayload,
  isPokemonBattleReplacementResolvedPayload,
  isPokemonBattleCompletedPayload,
  isPokemonBattleStateUpdatedPayload,
  isPokemonBattleTurnResolvedPayload,
  isPokemonStarterSelectedPayload,
  POKEMON_OVERWORLD_ITEM_EVENTS,
  isPokemonOverworldItemUsedPayload,
  isPokemonOverworldItemErrorPayload,
  POKEMON_PARTY_REORDER_EVENTS,
  isPokemonPartyReorderedPayload,
  isPokemonPartyReorderErrorPayload,
  isPokemonMoveLearningResolvedPayload,
  isPokemonMoveLearningErrorPayload,
  isPokemonEvolutionRequiredPayload,
  isPokemonEvolutionResolvedPayload,
  isPokemonEvolutionErrorPayload,
  POKEMON_CENTER_HEALING_EVENTS,
  isPokemonCenterHealedPayload,
  isPokemonCenterHealingErrorPayload,
  POKEMON_SHOP_EVENTS,
  isPokemonShopOpenedPayload,
  isPokemonShopPurchasedPayload,
  isPokemonShopSoldPayload,
  isPokemonShopClosedPayload,
  isPokemonShopErrorPayload,
} from "@cesar-mmo/shared";

import type {
  ChatMessage,
  ChatMessageInput,
  MapTransitionInput,
  MapTransitionResolved,
  Player,
  PlayerInput,
  PokemonTrainerStatePayload,
  PokemonStarterId,
  PokemonStarterChoiceInput,
  PokemonStarterSelectionStatus,
  PokemonStarterSelectedPayload,
  DialogueStartInput,
  DialogueSessionState,
  DialogueAdvanceInput,
  PokemonWildEncounterStartedPayload,
  PokemonBattleStartedPayload,
  PokemonBattleCommandInput,
  PokemonBattleReplacementInput,
  PokemonBattleReplacementResolvedPayload,
  PokemonBattleCompletedPayload,
  PokemonBattleStateUpdatedPayload,
  PokemonBattleTurnResolvedPayload,
  PokemonStorageOpenInput,
  PokemonStorageCommand,
  PokemonStorageStatePayload,
  PokemonStorageErrorPayload,
  PokemonOverworldItemUseInput,
  PokemonOverworldItemUsedPayload,
  PokemonOverworldItemErrorPayload,
  PokemonPartyReorderInput,
  PokemonPartyReorderedPayload,
  PokemonPartyReorderErrorPayload,
  PokemonMoveLearningDecisionInput,
  PokemonMoveLearningResolvedPayload,
  PokemonMoveLearningErrorPayload,
  PokemonEvolutionRequiredPayload,
  PokemonEvolutionDecisionInput,
  PokemonEvolutionResolvedPayload,
  PokemonEvolutionErrorPayload,
  PokemonCenterHealInput,
  PokemonCenterHealedPayload,
  PokemonCenterHealingErrorPayload,
  PokemonTrainerBattleStartInput,
  PokemonShopOpenInput,
  PokemonShopBuyInput,
  PokemonShopSellInput,
  PokemonShopCloseInput,
  PokemonShopOpenedPayload,
  PokemonShopPurchasedPayload,
  PokemonShopSoldPayload,
  PokemonShopClosedPayload,
  PokemonShopErrorPayload,
} from "@cesar-mmo/shared";

// deploy
import { resolveApiBaseUrl } from "../../config/runtime-environment";

type ConnectionRejectedError = {
  code: string;
  message: string;
};

export type GameNetworkClientConnectionInput = {
  selectedTrainerId: string;
};
export class GameNetworkClient {
  private readonly socket: Socket;

  constructor(input: GameNetworkClientConnectionInput) {
    const serverUrl = resolveApiBaseUrl();

    this.socket = io(serverUrl, {
      withCredentials: true,
      auth: {
        selectedTrainerId: input.selectedTrainerId,
      },
    });
  }

  public get id(): string | undefined {
    return this.socket.id;
  }

  public get connected(): boolean {
    return this.socket.connected;
  }

  public disconnect(): void {
    this.socket.disconnect();
  }

  public destroy(): void {
    /*
     * Scene teardown must not leave Socket.IO listeners attached to an old
     * GameScene instance. Remove listeners before disconnecting so an
     * intentional teardown is not reported as a transient connection loss.
     */
    this.socket.removeAllListeners();
    this.socket.disconnect();
  }

  public onConnectionRejected(callback: (error: ConnectionRejectedError) => void): void {
    this.socket.on("connectionRejected", callback);
  }

  public onConnect(callback: (socketId: string | undefined) => void): void {
    this.socket.on("connect", () => {
      callback(this.socket.id);
    });
  }

  public onDisconnect(callback: (reason: string) => void): () => void {
    const handler = (reason: string): void => {
      callback(reason);
    };

    this.socket.on("disconnect", handler);

    return () => {
      this.socket.off("disconnect", handler);
    };
  }

  public onChatMessage(callback: (message: ChatMessage) => void): void {
    this.socket.on(CHAT_EVENTS.MESSAGE_RECEIVED, callback);
  }

  // pokemon trainer party
  public onPokemonTrainerState(
    callback: (payload: PokemonTrainerStatePayload) => void
  ): void {
    this.socket.on(POKEMON_EVENTS.TRAINER_STATE, callback);
  }

  public onStarterSelectionStatus(
    callback: (status: PokemonStarterSelectionStatus) => void
  ): void {
    this.socket.on(POKEMON_EVENTS.STARTER_SELECTION_STATUS, callback);
  }

  public onStarterSelected(
    callback: (payload: PokemonStarterSelectedPayload) => void
  ): void {
    this.socket.on(POKEMON_EVENTS.STARTER_SELECTED, (payload: unknown) => {
      if (!isPokemonStarterSelectedPayload(payload)) {
        console.warn("[PokemonStarter] invalid selected payload", payload);
        return;
      }

      callback(payload);
    });
  }

  public reorderPokemonParty(input: PokemonPartyReorderInput): void {
    this.socket.emit(POKEMON_PARTY_REORDER_EVENTS.REORDER, input);
  }

  public onPokemonPartyReordered(
    callback: (payload: PokemonPartyReorderedPayload) => void
  ): void {
    this.socket.on(POKEMON_PARTY_REORDER_EVENTS.REORDERED, (payload: unknown) => {
      if (!isPokemonPartyReorderedPayload(payload)) {
        console.warn("[PokemonParty] invalid REORDERED payload", payload);
        return;
      }
      callback(payload);
    });
  }

  public onPokemonPartyReorderError(
    callback: (payload: PokemonPartyReorderErrorPayload) => void
  ): void {
    this.socket.on(POKEMON_PARTY_REORDER_EVENTS.ERROR, (payload: unknown) => {
      if (!isPokemonPartyReorderErrorPayload(payload)) {
        console.warn("[PokemonParty] invalid REORDER ERROR payload", payload);
        return;
      }
      callback(payload);
    });
  }

  // wild encounters
  public onWildEncounterStarted(
    callback: (payload: PokemonWildEncounterStartedPayload) => void
  ): void {
    this.socket.on(POKEMON_EVENTS.WILD_ENCOUNTER_STARTED, (payload: unknown) => {
      if (!isPokemonWildEncounterStartedPayload(payload)) {
        console.warn("[WildEncounter] invalid payload received");
        return;
      }
      callback(payload);
    });
  }

  // progression
  public sendPokemonMoveLearningDecision(input: PokemonMoveLearningDecisionInput): void {
    this.socket.emit(POKEMON_EVENTS.MOVE_LEARNING_DECISION, input);
  }

  public onPokemonMoveLearningResolved(
    callback: (payload: PokemonMoveLearningResolvedPayload) => void
  ): void {
    this.socket.on(POKEMON_EVENTS.MOVE_LEARNING_RESOLVED, (payload: unknown) => {
      if (!isPokemonMoveLearningResolvedPayload(payload)) {
        console.warn("[MoveLearning] invalid RESOLVED payload", payload);
        return;
      }
      callback(payload);
    });
  }

  public onPokemonMoveLearningError(
    callback: (payload: PokemonMoveLearningErrorPayload) => void
  ): void {
    this.socket.on(POKEMON_EVENTS.MOVE_LEARNING_ERROR, (payload: unknown) => {
      if (!isPokemonMoveLearningErrorPayload(payload)) {
        console.warn("[MoveLearning] invalid ERROR payload", payload);
        return;
      }
      callback(payload);
    });
  }

  // evolution
  public sendPokemonEvolutionDecision(input: PokemonEvolutionDecisionInput): void {
    this.socket.emit(POKEMON_EVENTS.EVOLUTION_DECISION, input);
  }

  public onPokemonEvolutionRequired(
    callback: (payload: PokemonEvolutionRequiredPayload) => void
  ): void {
    this.socket.on(POKEMON_EVENTS.EVOLUTION_REQUIRED, (payload: unknown) => {
      if (!isPokemonEvolutionRequiredPayload(payload)) {
        console.warn("[Evolution] invalid REQUIRED payload", payload);
        return;
      }
      callback(payload);
    });
  }

  public onPokemonEvolutionResolved(
    callback: (payload: PokemonEvolutionResolvedPayload) => void
  ): void {
    this.socket.on(POKEMON_EVENTS.EVOLUTION_RESOLVED, (payload: unknown) => {
      if (!isPokemonEvolutionResolvedPayload(payload)) {
        console.warn("[Evolution] invalid RESOLVED payload", payload);
        return;
      }
      callback(payload);
    });
  }

  public onPokemonEvolutionError(
    callback: (payload: PokemonEvolutionErrorPayload) => void
  ): void {
    this.socket.on(POKEMON_EVENTS.EVOLUTION_ERROR, (payload: unknown) => {
      if (!isPokemonEvolutionErrorPayload(payload)) {
        console.warn("[Evolution] invalid ERROR payload", payload);
        return;
      }
      callback(payload);
    });
  }

  // multiplayer
  public onCurrentPlayers(callback: (players: Record<string, Player>) => void): void {
    this.socket.on("currentPlayers", callback);
  }

  public onPlayerJoined(callback: (player: Player) => void): void {
    this.socket.on("playerJoined", callback);
  }

  public onPlayersState(callback: (players: Record<string, Player>) => void): void {
    this.socket.on("playersState", callback);
  }

  public onTransitionResolved(
    callback: (transition: MapTransitionResolved) => void
  ): void {
    this.socket.on(MAP_EVENTS.TRANSITION_RESOLVED, callback);
  }

  public onPlayerDisconnected(callback: (playerId: string) => void): void {
    this.socket.on("playerDisconnected", callback);
  }

  public onPlayerLeftMap(callback: (playerId: string) => void): void {
    this.socket.on(MAP_EVENTS.PLAYER_LEFT, callback);
  }

  public onDialogueState(callback: (state: DialogueSessionState) => void): void {
    this.socket.on(DIALOGUE_EVENTS.STATE, callback);
  }

  // choose starters
  public chooseStarter(starterId: PokemonStarterId): void {
    const payload: PokemonStarterChoiceInput = {
      starterId,
    };
    this.socket.emit(POKEMON_EVENTS.CHOOSE_STARTER, payload);
  }

  // battles
  public sendBattleCommand(input: PokemonBattleCommandInput): void {
    this.socket.emit(POKEMON_EVENTS.BATTLE_COMMAND, input);
  }

  public sendBattleReplacement(input: PokemonBattleReplacementInput): void {
    this.socket.emit(POKEMON_EVENTS.BATTLE_REPLACEMENT, input);
  }

  public requestBlackoutRecovery(): void {
    this.socket.emit(POKEMON_EVENTS.BLACKOUT_RECOVERY_REQUEST);
  }

  public onBattleReplacementResolved(
    callback: (payload: PokemonBattleReplacementResolvedPayload) => void
  ): void {
    this.socket.on(POKEMON_EVENTS.BATTLE_REPLACEMENT_RESOLVED, (payload: unknown) => {
      if (!isPokemonBattleReplacementResolvedPayload(payload)) {
        console.warn("[BattleReplacement] invalid resolved payload", payload);
        return;
      }
      callback(payload);
    });
  }

  public onBattleCompleted(
    callback: (payload: PokemonBattleCompletedPayload) => void
  ): void {
    this.socket.on(POKEMON_EVENTS.BATTLE_COMPLETED, (payload: unknown) => {
      if (!isPokemonBattleCompletedPayload(payload)) {
        console.warn("[BattleCompleted] invalid payload", payload);
        return;
      }
      callback(payload);
    });
  }

  public onBattleStateUpdated(
    callback: (payload: PokemonBattleStateUpdatedPayload) => void
  ): void {
    this.socket.on(POKEMON_EVENTS.BATTLE_STATE_UPDATED, (payload: unknown) => {
      if (!isPokemonBattleStateUpdatedPayload(payload)) {
        console.warn("[BattleState] invalid payload", payload);
        return;
      }
      callback(payload);
    });
  }

  // pokemon overworld items
  public usePokemonOverworldItem(input: PokemonOverworldItemUseInput): void {
    this.socket.emit(POKEMON_OVERWORLD_ITEM_EVENTS.USE, input);
  }

  public onPokemonOverworldItemUsed(
    callback: (payload: PokemonOverworldItemUsedPayload) => void
  ): void {
    this.socket.on(POKEMON_OVERWORLD_ITEM_EVENTS.USED, (payload: unknown) => {
      if (!isPokemonOverworldItemUsedPayload(payload)) {
        console.warn("[PokemonOverworldItem] invalid USED payload", payload);
        return;
      }
      callback(payload);
    });
  }

  public onPokemonOverworldItemError(
    callback: (payload: PokemonOverworldItemErrorPayload) => void
  ): void {
    this.socket.on(POKEMON_OVERWORLD_ITEM_EVENTS.ERROR, (payload: unknown) => {
      if (!isPokemonOverworldItemErrorPayload(payload)) {
        console.warn("[PokemonOverworldItem] invalid ERROR payload", payload);
        return;
      }
      callback(payload);
    });
  }

  // pokemon center healing
  public requestPokemonCenterHealing(healingStationId: string): void {
    const payload: PokemonCenterHealInput = {
      healingStationId,
    };
    this.socket.emit(POKEMON_CENTER_HEALING_EVENTS.HEAL, payload);
  }

  public onPokemonCenterHealed(
    callback: (payload: PokemonCenterHealedPayload) => void
  ): void {
    this.socket.on(POKEMON_CENTER_HEALING_EVENTS.HEALED, (payload: unknown) => {
      if (!isPokemonCenterHealedPayload(payload)) {
        console.warn("[PokemonCenterHealing] invalid HEALED payload", payload);
        return;
      }
      callback(payload);
    });
  }

  public onPokemonCenterHealingError(
    callback: (payload: PokemonCenterHealingErrorPayload) => void
  ): void {
    this.socket.on(POKEMON_CENTER_HEALING_EVENTS.ERROR, (payload: unknown) => {
      if (!isPokemonCenterHealingErrorPayload(payload)) {
        console.warn("[PokemonCenterHealing] invalid ERROR payload", payload);
        return;
      }
      callback(payload);
    });
  }

  // pokemon shop
  public openPokemonShop(npcId: string): void {
    const payload: PokemonShopOpenInput = { npcId };
    this.socket.emit(POKEMON_SHOP_EVENTS.OPEN, payload);
  }

  public buyPokemonShopItem(input: PokemonShopBuyInput): void {
    this.socket.emit(POKEMON_SHOP_EVENTS.BUY, input);
  }

  public sellPokemonShopItem(input: PokemonShopSellInput): void {
    this.socket.emit(POKEMON_SHOP_EVENTS.SELL, input);
  }

  public closePokemonShop(sessionId: string): void {
    const payload: PokemonShopCloseInput = { sessionId };
    this.socket.emit(POKEMON_SHOP_EVENTS.CLOSE, payload);
  }

  public onPokemonShopOpened(
    callback: (payload: PokemonShopOpenedPayload) => void
  ): void {
    this.socket.on(POKEMON_SHOP_EVENTS.OPENED, (payload: unknown) => {
      if (!isPokemonShopOpenedPayload(payload)) {
        console.warn("[PokemonShop] invalid OPENED payload", payload);
        return;
      }

      callback(payload);
    });
  }

  public onPokemonShopPurchased(
    callback: (payload: PokemonShopPurchasedPayload) => void
  ): void {
    this.socket.on(POKEMON_SHOP_EVENTS.PURCHASED, (payload: unknown) => {
      if (!isPokemonShopPurchasedPayload(payload)) {
        console.warn("[PokemonShop] invalid PURCHASED payload", payload);
        return;
      }

      callback(payload);
    });
  }

  public onPokemonShopSold(
    callback: (payload: PokemonShopSoldPayload) => void
  ): void {
    this.socket.on(POKEMON_SHOP_EVENTS.SOLD, (payload: unknown) => {
      if (!isPokemonShopSoldPayload(payload)) {
        console.warn("[PokemonShop] invalid SOLD payload", payload);
        return;
      }

      callback(payload);
    });
  }

  public onPokemonShopClosed(
    callback: (payload: PokemonShopClosedPayload) => void
  ): void {
    this.socket.on(POKEMON_SHOP_EVENTS.CLOSED, (payload: unknown) => {
      if (!isPokemonShopClosedPayload(payload)) {
        console.warn("[PokemonShop] invalid CLOSED payload", payload);
        return;
      }

      callback(payload);
    });
  }

  public onPokemonShopError(
    callback: (payload: PokemonShopErrorPayload) => void
  ): void {
    this.socket.on(POKEMON_SHOP_EVENTS.ERROR, (payload: unknown) => {
      if (!isPokemonShopErrorPayload(payload)) {
        console.warn("[PokemonShop] invalid ERROR payload", payload);
        return;
      }

      callback(payload);
    });
  }

  // pokemon storage
  public openPokemonStorage(terminalId: string): void {
    const payload: PokemonStorageOpenInput = {
      terminalId,
    };

    this.socket.emit(POKEMON_EVENTS.STORAGE_OPEN, payload);
  }

  public closePokemonStorage(): void {
    this.socket.emit(POKEMON_EVENTS.STORAGE_CLOSE);
  }

  public sendPokemonStorageCommand(command: PokemonStorageCommand): void {
    this.socket.emit(POKEMON_EVENTS.STORAGE_COMMAND, command);
  }

  public onPokemonStorageState(
    callback: (payload: PokemonStorageStatePayload) => void
  ): void {
    this.socket.on(POKEMON_EVENTS.STORAGE_STATE, callback);
  }

  public onPokemonStorageError(
    callback: (payload: PokemonStorageErrorPayload) => void
  ): void {
    this.socket.on(POKEMON_EVENTS.STORAGE_ERROR, callback);
  }

  // players
  public sendPlayerInput(input: PlayerInput): void {
    this.socket.emit("playerInput", input);
  }

  public sendChatMessage(input: ChatMessageInput): void {
    this.socket.emit(CHAT_EVENTS.SEND_MESSAGE, input);
  }

  public requestMapTransition(input: MapTransitionInput): void {
    this.socket.emit(MAP_EVENTS.REQUEST_TRANSITION, input);
  }

  public startDialogue(npcId: string): void {
    const payload: DialogueStartInput = {
      npcId,
    };
    this.socket.emit(DIALOGUE_EVENTS.START, payload);
  }

  public advanceDialogue(sessionId: string): void {
    const payload: DialogueAdvanceInput = {
      sessionId,
    };
    this.socket.emit(DIALOGUE_EVENTS.ADVANCE, payload);
  }

  public cancelDialogue(): void {
    this.socket.emit(DIALOGUE_EVENTS.CANCEL);
  }


  public startTrainerBattle(npcId: string): void {
    const payload: PokemonTrainerBattleStartInput = {
      npcId,
    };

    this.socket.emit(POKEMON_EVENTS.TRAINER_BATTLE_START, payload);
  }

  public onBattleStarted(
    callback: (payload: PokemonBattleStartedPayload) => void
  ): () => void {
    const handler = (payload: unknown) => {
      if (!isPokemonBattleStartedPayload(payload)) {
        console.warn("Ignoring invalid battle started payload", payload);
        return;
      }
      callback(payload);
    };
    this.socket.on(POKEMON_EVENTS.BATTLE_STARTED, handler);
    return () => {
      this.socket.off(POKEMON_EVENTS.BATTLE_STARTED, handler);
    };
  }

  public onBattleTurnResolved(
    callback: (payload: PokemonBattleTurnResolvedPayload) => void
  ): void {
    this.socket.on(POKEMON_EVENTS.BATTLE_TURN_RESOLVED, (payload: unknown) => {
      if (!isPokemonBattleTurnResolvedPayload(payload)) {
        console.warn("[BattleTurnResolved] invalid payload", payload);
        return;
      }

      callback(payload);
    });
  }
}
