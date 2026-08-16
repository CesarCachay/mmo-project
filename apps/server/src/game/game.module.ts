import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { ChatService } from 'src/chat/chat.service';

@Module({
  providers: [GameGateway, ChatService],
})
export class GameModule {}
