import {
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  MessageBody,
} from '@nestjs/websockets';

import { OnModuleDestroy } from '@nestjs/common';

import { Server, Socket } from 'socket.io';

import {
  DEFAULT_MAP_ID,
  PLAYER_SIZE,
  PLAYER_COLORS,
  SERVER_TICK_RATE,
  applyPlayerMovement,
  resolveMapCollision,
  isPlayerMoving,
  getDirectionFromInput,
  isPlayerAvatarId,
  CHAT_EVENTS,
  isChatMessageInput,
  isMapTransitionInput,
  MAP_EVENTS,
  MAP_DATA_REGISTRY,
  POKEMON_EVENTS,
  isPokemonStarterChoiceInput,
} from '@cesar-mmo/shared';
import {
  getServerMapSpawn,
  getServerMapTransition,
  isPlayerInsideMapTransition,
} from './maps/serverMapRegistry';
import { ChatService } from 'src/chat/chat.service';

import type {
  Player,
  PlayerInput,
  MapTransitionResolved,
  MapId,
  PokemonTrainerStatePayload,
} from '@cesar-mmo/shared';

import { PokemonTrainerService } from 'src/pokemon/pokemon-trainer.service';
import { PokemonTrainerStateStore } from 'src/pokemon/pokemon-trainer-state.store';

@WebSocketGateway({
  cors: {
    origin: 'http://localhost:5173',
  },
})
export class GameGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleDestroy
{
  @WebSocketServer()
  server!: Server;

  private players: Record<string, Player> = {};

  private playerInputs: Record<string, PlayerInput> = {};

  private readonly pokemonTrainerStateStore = new PokemonTrainerStateStore();
  private readonly pokemonTrainerService = new PokemonTrainerService(
    this.pokemonTrainerStateStore,
  );

  private nextColorIndex = 0;

  private gameLoop?: ReturnType<typeof setInterval>;

  constructor(private readonly chatService: ChatService) {}

  afterInit() {
    this.startGameLoop();
  }

  onModuleDestroy() {
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
    }
  }

  async handleConnection(client: Socket): Promise<void> {
    const displayName = this.getRequestedDisplayName(client);
    const avatarId: unknown = client.handshake.auth.avatarId;

    if (!isPlayerAvatarId(avatarId)) {
      client.emit('connectionRejected', {
        code: 'INVALID_AVATAR',
        message: 'Invalid character selected.',
      });

      client.disconnect();

      return;
    }

    if (!displayName) {
      client.emit('connectionRejected', {
        code: 'INVALID_DISPLAY_NAME',
        message: 'Player name must contain between 3 and 16 characters.',
      });
      client.disconnect(true);
      return;
    }

    if (this.isDisplayNameInUse(displayName)) {
      client.emit('connectionRejected', {
        code: 'NAME_ALREADY_IN_USE',
        message: 'That player name is already in use.',
      });
      client.disconnect(true);
      return;
    }

    const color = PLAYER_COLORS[this.nextColorIndex % PLAYER_COLORS.length];

    this.nextColorIndex++;

    const newPlayer: Player = {
      id: client.id,
      mapId: DEFAULT_MAP_ID,
      displayName,
      avatarId,
      x: MAP_DATA_REGISTRY[DEFAULT_MAP_ID].spawn.x,
      y: MAP_DATA_REGISTRY[DEFAULT_MAP_ID].spawn.y,
      color,
      direction: 'down',
      isMoving: false,
      lastProcessedInputSequence: 0,
    };

    this.players[client.id] = newPlayer;

    this.playerInputs[client.id] = {
      sequence: 0,
      up: false,
      down: false,
      left: false,
      right: false,
    };

    const trainerState = this.pokemonTrainerStateStore.create(newPlayer.id);
    const trainerStatePayload: PokemonTrainerStatePayload = {
      trainerState,
    };
    client.emit(POKEMON_EVENTS.TRAINER_STATE, trainerStatePayload);

    const mapRoom = this.getMapRoom(newPlayer.mapId);
    await client.join(mapRoom);

    console.log(`Player connected: ${client.id}`);
    client.emit('currentPlayers', this.getPlayersInMap(newPlayer.mapId));
    client.to(mapRoom).emit('playerJoined', newPlayer);
  }

  handleDisconnect(client: Socket) {
    const player = this.players[client.id];

    this.pokemonTrainerStateStore.remove(client.id);

    if (!player) {
      return;
    }

    console.log(`Player disconnected: ${client.id}`);

    const mapRoom = this.getMapRoom(player.mapId);
    delete this.players[client.id];
    delete this.playerInputs[client.id];

    this.server.to(mapRoom).emit('playerDisconnected', client.id);
  }

  @SubscribeMessage('playerInput')
  handlePlayerInput(
    @ConnectedSocket() client: Socket,
    @MessageBody() input: PlayerInput,
  ) {
    const player = this.players[client.id];

    if (!player) {
      return;
    }

    if (input.sequence <= player.lastProcessedInputSequence) {
      return;
    }

    this.playerInputs[client.id] = input;

    player.lastProcessedInputSequence = input.sequence;
  }

  @SubscribeMessage(CHAT_EVENTS.SEND_MESSAGE)
  handleChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ): void {
    if (!isChatMessageInput(payload)) {
      return;
    }

    const player = this.players[client.id];

    if (!player) {
      return;
    }

    const message = this.chatService.createMessage(player, payload);

    this.server.emit(CHAT_EVENTS.MESSAGE_RECEIVED, message);
  }

  @SubscribeMessage(POKEMON_EVENTS.CHOOSE_STARTER)
  handleChooseStarter(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ): void {
    if (!isPokemonStarterChoiceInput(payload)) {
      return;
    }

    const player = this.players[client.id];

    if (!player) {
      return;
    }

    const trainerState = this.pokemonTrainerService.chooseStarter(
      player.id,
      payload.starterId,
    );

    const trainerStatePayload: PokemonTrainerStatePayload = {
      trainerState,
    };

    client.emit(POKEMON_EVENTS.TRAINER_STATE, trainerStatePayload);
  }

  @SubscribeMessage(MAP_EVENTS.REQUEST_TRANSITION)
  async handleMapTransitionRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    if (!isMapTransitionInput(payload)) {
      return;
    }

    const player = this.players[client.id];

    if (!player) {
      return;
    }

    const transition = getServerMapTransition(
      player.mapId,
      payload.transitionId,
    );

    if (!transition) {
      return;
    }

    const isInsideTransition = isPlayerInsideMapTransition(
      player.x,
      player.y,
      transition,
    );

    if (!isInsideTransition) {
      console.warn('[MapTransition] rejected: player outside trigger', {
        playerId: player.id,
        mapId: player.mapId,
        transitionId: payload.transitionId.trim(),
        x: player.x,
        y: player.y,
      });

      return;
    }

    const targetSpawn = getServerMapSpawn(
      transition.targetMapId,
      transition.targetSpawn,
    );
    if (!targetSpawn) {
      return;
    }

    const fromMapId = player.mapId;
    const resolvedTransition: MapTransitionResolved = {
      transitionId: payload.transitionId.trim(),
      fromMapId,
      targetMapId: transition.targetMapId,
      targetSpawn: transition.targetSpawn,
      x: targetSpawn.x,
      y: targetSpawn.y,
    };

    const fromRoom = this.getMapRoom(fromMapId);
    const targetRoom = this.getMapRoom(transition.targetMapId);

    /* Informamos inmediatamente a los demás jugadores del mapa anterior */
    client.to(fromRoom).emit(MAP_EVENTS.PLAYER_LEFT, player.id);
    await client.leave(fromRoom);

    player.mapId = transition.targetMapId;
    player.x = targetSpawn.x;
    player.y = targetSpawn.y;
    player.isMoving = false;

    this.playerInputs[client.id] = {
      sequence: player.lastProcessedInputSequence,
      up: false,
      down: false,
      left: false,
      right: false,
    };

    /* Entramos al nuevo room */
    await client.join(targetRoom);

    /* Los jugadores que ya estaban en el destino deben saber que llegamos */
    client.to(targetRoom).emit('playerJoined', player);

    client.emit(MAP_EVENTS.TRANSITION_RESOLVED, resolvedTransition);
  }

  private startGameLoop() {
    const tickInterval = 1000 / SERVER_TICK_RATE;

    this.gameLoop = setInterval(() => {
      this.updatePlayers(tickInterval);
    }, tickInterval);
  }

  private updatePlayers(deltaMs: number) {
    const deltaSeconds = deltaMs / 1000;

    for (const [playerId, player] of Object.entries(this.players)) {
      const input = this.playerInputs[playerId];

      if (!input) {
        continue;
      }

      this.updatePlayer(player, input, deltaSeconds);
    }

    this.emitPlayersStateByMap();
  }

  private updatePlayer(
    player: Player,
    input: PlayerInput,
    deltaSeconds: number,
  ) {
    player.direction = getDirectionFromInput(input, player.direction);
    player.isMoving = isPlayerMoving(input);

    const mapData = MAP_DATA_REGISTRY[player.mapId];

    const updatedPlayer = applyPlayerMovement(player, input, deltaSeconds);
    const resolvedPosition = resolveMapCollision(
      {
        x: player.x,
        y: player.y,
      },
      {
        x: updatedPlayer.x,
        y: updatedPlayer.y,
      },
      PLAYER_SIZE,
      mapData,
    );

    player.x = resolvedPosition.x;
    player.y = resolvedPosition.y;
  }

  private getRequestedDisplayName(client: Socket): string | null {
    const auth: unknown = client.handshake.auth;

    if (typeof auth !== 'object' || auth === null) {
      return null;
    }

    const { displayName } = auth as Record<string, unknown>;

    if (typeof displayName !== 'string') {
      return null;
    }

    const normalizedDisplayName = displayName.trim();

    if (normalizedDisplayName.length < 3 || normalizedDisplayName.length > 16) {
      return null;
    }

    return normalizedDisplayName;
  }

  private isDisplayNameInUse(displayName: string): boolean {
    const normalizedDisplayName = displayName.trim().toLowerCase();

    return Object.values(this.players).some(
      (player) =>
        player.displayName.trim().toLowerCase() === normalizedDisplayName,
    );
  }

  private getMapRoom(mapId: MapId): string {
    return `map:${mapId}`;
  }

  private getPlayersInMap(mapId: MapId): Record<string, Player> {
    const playersInMap: Record<string, Player> = {};

    for (const [playerId, player] of Object.entries(this.players)) {
      if (player.mapId !== mapId) {
        continue;
      }
      playersInMap[playerId] = player;
    }

    return playersInMap;
  }

  private emitPlayersStateByMap(): void {
    const activeMapIds = new Set<MapId>();

    for (const player of Object.values(this.players)) {
      activeMapIds.add(player.mapId);
    }

    for (const mapId of activeMapIds) {
      const room = this.getMapRoom(mapId);
      const players = this.getPlayersInMap(mapId);
      this.server.to(room).emit('playersState', players);
    }
  }
}
