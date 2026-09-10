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
import { PokemonOverworldItemRepository } from 'src/pokemon/items/pokemon-overworld-item.repository';
import { PokemonProgressionManager } from '../pokemon/progression/pokemon-progression.manager';
import { PokemonPartyProgressionRepository } from '../pokemon/progression/pokemon-party-progression.repository';
import { PokemonPartyProgressionService } from '../pokemon/progression/pokemon-party-progression.service';
import { PokemonWildBattleProgressionService } from '../pokemon/battles/pokemon-wild-battle-progression.service';
import { PokemonTrainerStateStore } from 'src/pokemon/pokemon-trainer-state.store';
import { PokemonProgressionService } from 'src/pokemon/progression/pokemon-progression.service';
import { PokemonProgressionRepository } from 'src/pokemon/progression/pokemon-progression.repository';
import { PokemonProgressionOperationQueue } from 'src/pokemon/progression/pokemon-progression-operation.queue';
import { PokemonPendingMoveLearningRepository } from 'src/pokemon/progression/pokemon-pending-move-learning.repository';
import { PokemonPendingMoveLearningStore } from 'src/pokemon/progression/pokemon-pending-move-learning.store';
import { PokemonPendingMoveLearningService } from 'src/pokemon/progression/pokemon-pending-move-learning.service';

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
    PokemonOverworldItemRepository,
    PokemonProgressionManager,
    PokemonPartyProgressionRepository,
    PokemonPartyProgressionService,
    PokemonWildBattleProgressionService,
    PokemonTrainerStateStore,
    PokemonProgressionService,
    PokemonProgressionRepository,
    PokemonProgressionOperationQueue,
    PokemonPendingMoveLearningRepository,
    PokemonPendingMoveLearningStore,
    PokemonPendingMoveLearningService,
  ],
})
export class GameModule {}
