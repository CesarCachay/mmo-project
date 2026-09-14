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
} from "@cesar-mmo/shared";

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
    const serverUrl =
      import.meta.env.VITE_API_URL?.trim() || "http://localhost:3000";

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

  public onConnectionRejected(
    callback: (error: ConnectionRejectedError) => void,
  ): void {
    this.socket.on("connectionRejected", callback);
  }

  public onConnect(callback: (socketId: string | undefined) => void): void {
    this.socket.on("connect", () => {
      callback(this.socket.id);
    });
  }

  public onChatMessage(callback: (message: ChatMessage) => void): void {
    this.socket.on(CHAT_EVENTS.MESSAGE_RECEIVED, callback);
  }

  // pokemon trainer party
  public onPokemonTrainerState(
    callback: (payload: PokemonTrainerStatePayload) => void,
  ): void {
    this.socket.on(POKEMON_EVENTS.TRAINER_STATE, callback);
  }

  public onStarterSelectionStatus(
    callback: (status: PokemonStarterSelectionStatus) => void,
  ): void {
    this.socket.on(POKEMON_EVENTS.STARTER_SELECTION_STATUS, callback);
  }

  public reorderPokemonParty(input: PokemonPartyReorderInput): void {
    this.socket.emit(POKEMON_PARTY_REORDER_EVENTS.REORDER, input);
  }

  public onPokemonPartyReordered(
    callback: (payload: PokemonPartyReorderedPayload) => void,
  ): void {
    this.socket.on(
      POKEMON_PARTY_REORDER_EVENTS.REORDERED,
      (payload: unknown) => {
        if (!isPokemonPartyReorderedPayload(payload)) {
          console.warn("[PokemonParty] invalid REORDERED payload", payload);
          return;
        }
        callback(payload);
      },
    );
  }

  public onPokemonPartyReorderError(
    callback: (payload: PokemonPartyReorderErrorPayload) => void,
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
    callback: (payload: PokemonWildEncounterStartedPayload) => void,
  ): void {
    this.socket.on(
      POKEMON_EVENTS.WILD_ENCOUNTER_STARTED,
      (payload: unknown) => {
        if (!isPokemonWildEncounterStartedPayload(payload)) {
          console.warn("[WildEncounter] invalid payload received");
          return;
        }
        callback(payload);
      },
    );
  }

  // progression
  public sendPokemonMoveLearningDecision(
    input: PokemonMoveLearningDecisionInput,
  ): void {
    this.socket.emit(POKEMON_EVENTS.MOVE_LEARNING_DECISION, input);
  }

  public onPokemonMoveLearningResolved(
    callback: (payload: PokemonMoveLearningResolvedPayload) => void,
  ): void {
    this.socket.on(
      POKEMON_EVENTS.MOVE_LEARNING_RESOLVED,
      (payload: unknown) => {
        if (!isPokemonMoveLearningResolvedPayload(payload)) {
          console.warn("[MoveLearning] invalid RESOLVED payload", payload);
          return;
        }
        callback(payload);
      },
    );
  }

  public onPokemonMoveLearningError(
    callback: (payload: PokemonMoveLearningErrorPayload) => void,
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
  public sendPokemonEvolutionDecision(
    input: PokemonEvolutionDecisionInput,
  ): void {
    this.socket.emit(POKEMON_EVENTS.EVOLUTION_DECISION, input);
  }

  public onPokemonEvolutionRequired(
    callback: (payload: PokemonEvolutionRequiredPayload) => void,
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
    callback: (payload: PokemonEvolutionResolvedPayload) => void,
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
    callback: (payload: PokemonEvolutionErrorPayload) => void,
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
  public onCurrentPlayers(
    callback: (players: Record<string, Player>) => void,
  ): void {
    this.socket.on("currentPlayers", callback);
  }

  public onPlayerJoined(callback: (player: Player) => void): void {
    this.socket.on("playerJoined", callback);
  }

  public onPlayersState(
    callback: (players: Record<string, Player>) => void,
  ): void {
    this.socket.on("playersState", callback);
  }

  public onTransitionResolved(
    callback: (transition: MapTransitionResolved) => void,
  ): void {
    this.socket.on(MAP_EVENTS.TRANSITION_RESOLVED, callback);
  }

  public onPlayerDisconnected(callback: (playerId: string) => void): void {
    this.socket.on("playerDisconnected", callback);
  }

  public onPlayerLeftMap(callback: (playerId: string) => void): void {
    this.socket.on(MAP_EVENTS.PLAYER_LEFT, callback);
  }

  public onDialogueState(
    callback: (state: DialogueSessionState) => void,
  ): void {
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

  public onBattleReplacementResolved(
    callback: (payload: PokemonBattleReplacementResolvedPayload) => void,
  ): void {
    this.socket.on(
      POKEMON_EVENTS.BATTLE_REPLACEMENT_RESOLVED,
      (payload: unknown) => {
        if (!isPokemonBattleReplacementResolvedPayload(payload)) {
          console.warn("[BattleReplacement] invalid resolved payload", payload);
          return;
        }
        callback(payload);
      },
    );
  }

  public onBattleCompleted(
    callback: (payload: PokemonBattleCompletedPayload) => void,
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
    callback: (payload: PokemonBattleStateUpdatedPayload) => void,
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
    callback: (payload: PokemonOverworldItemUsedPayload) => void,
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
    callback: (payload: PokemonOverworldItemErrorPayload) => void,
  ): void {
    this.socket.on(POKEMON_OVERWORLD_ITEM_EVENTS.ERROR, (payload: unknown) => {
      if (!isPokemonOverworldItemErrorPayload(payload)) {
        console.warn("[PokemonOverworldItem] invalid ERROR payload", payload);
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
    callback: (payload: PokemonStorageStatePayload) => void,
  ): void {
    this.socket.on(POKEMON_EVENTS.STORAGE_STATE, callback);
  }

  public onPokemonStorageError(
    callback: (payload: PokemonStorageErrorPayload) => void,
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

  public onBattleStarted(
    callback: (payload: PokemonBattleStartedPayload) => void,
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
    callback: (payload: PokemonBattleTurnResolvedPayload) => void,
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
