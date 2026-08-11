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

type Player = {
  id: string;
  x: number;
  y: number;
};

@WebSocketGateway({
  cors: {
    origin: 'http://localhost:5173',
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private players: Record<string, Player> = {};

  handleConnection(client: Socket) {
    console.log(`Player connected: ${client.id}`);

    const newPlayer: Player = {
      id: client.id,
      x: 400,
      y: 300,
    };

    this.players[client.id] = newPlayer;

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
    @MessageBody() position: { x: number; y: number },
  ) {
    const player = this.players[client.id];

    if (!player) {
      return;
    }

    player.x = position.x;
    player.y = position.y;

    client.broadcast.emit('playerMoved', player);
  }
}
