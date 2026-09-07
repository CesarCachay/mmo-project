import { Module } from '@nestjs/common';

import { ChatService } from 'src/chat/chat.service';
import { PrismaService } from 'src/database/prisma.service';
import { PokemonPartyRepository } from 'src/pokemon/pokemon-party.repository';
import { PokemonTrainerRepository } from 'src/pokemon/pokemon-trainer.repository';
import { PokemonInventoryRepository } from 'src/pokemon/inventory/pokemon-inventory.repository';
import { PokemonCaptureRepository } from 'src/pokemon/battles/capture/pokemon-capture.repository';
import { PokemonStorageRepository } from 'src/pokemon/storage/pokemon-storage.repository';
import { PlayerWorldRuntimeStore } from './world/player-world-runtime.store';
import { PlayerWorldLocationRepository } from './world/player-world-location.repository';
import { PlayerWorldStateService } from './world/player-world-state.service';

import { GameGateway } from './game.gateway';

@Module({
  providers: [
    GameGateway,
    ChatService,
    PrismaService,
    PokemonTrainerRepository,
    PokemonPartyRepository,
    PokemonInventoryRepository,
    PokemonCaptureRepository,
    PokemonStorageRepository,
    PlayerWorldRuntimeStore,
    PlayerWorldLocationRepository,
    PlayerWorldStateService,
  ],
})
export class GameModule {}
