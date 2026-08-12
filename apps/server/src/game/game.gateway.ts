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
  GAME_HEIGHT,
  GAME_WIDTH,
  PLAYER_COLORS,
  PLAYER_SIZE,
  PLAYER_SPEED,
  SERVER_TICK_RATE,
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
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2,
      color,
    };

    this.players[client.id] = newPlayer;

    this.playerInputs[client.id] = {
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
    if (!this.players[client.id]) {
      return;
    }

    this.playerInputs[client.id] = input;
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
    let directionX = 0;
    let directionY = 0;

    if (input.left) {
      directionX -= 1;
    }

    if (input.right) {
      directionX += 1;
    }

    if (input.up) {
      directionY -= 1;
    }

    if (input.down) {
      directionY += 1;
    }

    if (directionX === 0 && directionY === 0) {
      return;
    }

    const magnitude = Math.sqrt(
      directionX * directionX + directionY * directionY,
    );

    directionX /= magnitude;
    directionY /= magnitude;

    player.x += directionX * PLAYER_SPEED * deltaSeconds;

    player.y += directionY * PLAYER_SPEED * deltaSeconds;

    this.clampPlayerPosition(player);
  }

  private clampPlayerPosition(player: Player) {
    const halfPlayerSize = PLAYER_SIZE / 2;

    player.x = Math.max(
      halfPlayerSize,
      Math.min(GAME_WIDTH - halfPlayerSize, player.x),
    );

    player.y = Math.max(
      halfPlayerSize,
      Math.min(GAME_HEIGHT - halfPlayerSize, player.y),
    );
  }
}
