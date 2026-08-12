import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  MessageBody,
} from '@nestjs/websockets';

import { Server, Socket } from 'socket.io';

import {
  GAME_HEIGHT,
  GAME_WIDTH,
  PLAYER_COLORS,
  PLAYER_SIZE,
  type Player,
  type PlayerPosition,
} from '@cesar-mmo/shared';

@WebSocketGateway({
  cors: {
    origin: 'http://localhost:5173',
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private players: Record<string, Player> = {};

  private nextColorIndex = 0;

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

    console.log(`Player connected: ${client.id}`);

    client.emit('currentPlayers', this.players);

    client.broadcast.emit('playerJoined', newPlayer);
  }

  handleDisconnect(client: Socket) {
    console.log(`Player disconnected: ${client.id}`);

    delete this.players[client.id];

    this.server.emit('playerDisconnected', client.id);
  }

  @SubscribeMessage('playerMove')
  handlePlayerMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() position: PlayerPosition,
  ) {
    const player = this.players[client.id];

    if (!player) {
      return;
    }

    const halfPlayerSize = PLAYER_SIZE / 2;

    player.x = Math.max(
      halfPlayerSize,
      Math.min(GAME_WIDTH - halfPlayerSize, position.x),
    );

    player.y = Math.max(
      halfPlayerSize,
      Math.min(GAME_HEIGHT - halfPlayerSize, position.y),
    );

    client.broadcast.emit('playerMoved', player);
  }
}
