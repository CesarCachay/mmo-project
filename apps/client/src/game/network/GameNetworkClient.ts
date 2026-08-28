import { io, type Socket } from "socket.io-client";

import {
  CHAT_EVENTS,
  MAP_EVENTS,
  POKEMON_EVENTS,
  DIALOGUE_EVENTS,
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
} from "@cesar-mmo/shared";

type ConnectionRejectedError = {
  code: string;
  message: string;
};

export class GameNetworkClient {
  private readonly socket: Socket;

  constructor(displayName: string, avatarId: PlayerAvatarId) {
    this.socket = io("http://localhost:3000", {
      auth: {
        displayName,
        avatarId,
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
}
