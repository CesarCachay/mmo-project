import { Module } from '@nestjs/common';

import { ChatService } from 'src/chat/chat.service';
import { PrismaService } from 'src/database/prisma.service';
import { PokemonPartyRepository } from 'src/pokemon/pokemon-party.repository';
import { PokemonTrainerRepository } from 'src/pokemon/pokemon-trainer.repository';
import { PokemonInventoryRepository } from 'src/pokemon/inventory/pokemon-inventory.repository';

import { GameGateway } from './game.gateway';

@Module({
  providers: [
    GameGateway,
    ChatService,
    PrismaService,
    PokemonTrainerRepository,
    PokemonPartyRepository,
    PokemonInventoryRepository,
  ],
})
export class GameModule {}
