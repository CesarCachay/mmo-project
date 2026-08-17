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
  TOWN_01_MAP,
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
} from '@cesar-mmo/shared';
import { ChatService } from 'src/chat/chat.service';

import type { Player, PlayerInput } from '@cesar-mmo/shared';

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

  handleConnection(client: Socket) {
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
      x: TOWN_01_MAP.spawn.x,
      y: TOWN_01_MAP.spawn.y,
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

    console.log(`Player connected: ${client.id}`);

    client.emit('currentPlayers', this.players);

    client.broadcast.emit('playerJoined', newPlayer);
  }

  handleDisconnect(client: Socket) {
    console.log(`Player disconnected: ${client.id}`);

    const player = this.players[client.id];
    if (!player) {
      return;
    }

    console.log(`Player disconnected: ${client.id}`);

    delete this.players[client.id];
    delete this.playerInputs[client.id];

    this.server.emit('playerDisconnected', client.id);
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

    this.server.emit('playersState', this.players);
  }

  private updatePlayer(
    player: Player,
    input: PlayerInput,
    deltaSeconds: number,
  ) {
    player.direction = getDirectionFromInput(input, player.direction);
    player.isMoving = isPlayerMoving(input);

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
      TOWN_01_MAP,
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
}
