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
  TOWN_01_MAP,
  PLAYER_SIZE,
  PLAYER_COLORS,
  SERVER_TICK_RATE,
  applyPlayerMovement,
  resolveMapCollision,
} from '@cesar-mmo/shared';

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

  afterInit() {
    this.startGameLoop();
  }

  onModuleDestroy() {
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
    }
  }

  handleConnection(client: Socket) {
    const color = PLAYER_COLORS[this.nextColorIndex % PLAYER_COLORS.length];

    this.nextColorIndex++;

    const newPlayer: Player = {
      id: client.id,
      x: TOWN_01_MAP.spawn.x,
      y: TOWN_01_MAP.spawn.y,
      color,
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

    delete this.players[client.id];

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
}
