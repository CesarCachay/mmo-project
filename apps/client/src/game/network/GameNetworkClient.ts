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
} from "@cesar-mmo/shared";

import type {
  ChatMessage,
  ChatMessageInput,
  MapTransitionInput,
  MapTransitionResolved,
  Player,
  PlayerAvatarId,
  PlayerInput,
  PokemonTrainerStatePayload,
  PokemonStarterId,
  PokemonStarterChoiceInput,
  PokemonStarterSelectionStatus,
  DialogueStartInput,
  DialogueSessionState,
  DialogueAdvanceInput,
  PokemonTrainerSessionPayload,
  PokemonWildEncounterStartedPayload,
  PokemonBattleStartedPayload,
  PokemonBattleCommandInput,
  PokemonBattleReplacementInput,
  PokemonBattleReplacementResolvedPayload,
  PokemonBattleCompletedPayload,
  PokemonBattleStateUpdatedPayload,
} from "@cesar-mmo/shared";

type ConnectionRejectedError = {
  code: string;
  message: string;
};

export class GameNetworkClient {
  private readonly socket: Socket;

  constructor(
    displayName: string,
    avatarId: PlayerAvatarId,
    trainerSessionToken?: string
  ) {
    this.socket = io("http://localhost:3000", {
      auth: {
        displayName,
        avatarId,
        trainerSessionToken,
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

  public onConnectionRejected(callback: (error: ConnectionRejectedError) => void): void {
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
    callback: (payload: PokemonTrainerStatePayload) => void
  ): void {
    this.socket.on(POKEMON_EVENTS.TRAINER_STATE, callback);
  }
  public onStarterSelectionStatus(
    callback: (status: PokemonStarterSelectionStatus) => void
  ): void {
    this.socket.on(POKEMON_EVENTS.STARTER_SELECTION_STATUS, callback);
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

  public onPokemonTrainerSession(
    callback: (payload: PokemonTrainerSessionPayload) => void
  ): void {
    this.socket.on(POKEMON_EVENTS.TRAINER_SESSION, callback);
  }

  onBattleStarted(callback: (payload: PokemonBattleStartedPayload) => void): () => void {
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
}
