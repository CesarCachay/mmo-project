import { Module } from '@nestjs/common';

import { ChatService } from '#app/chat/chat.service';
import { PrismaService } from '#app/database/prisma.service';
import { PokemonPartyRepository } from '#app/pokemon/pokemon-party.repository';
import { PokemonInventoryRepository } from '#app/pokemon/inventory/pokemon-inventory.repository';
import { PokemonCaptureRepository } from '#app/pokemon/battles/capture/pokemon-capture.repository';
import { PokemonStorageRepository } from '#app/pokemon/storage/pokemon-storage.repository';
import { PlayerWorldRuntimeStore } from './world/player-world-runtime.store';
import { PlayerWorldLocationRepository } from './world/player-world-location.repository';
import { PlayerWorldStateService } from './world/player-world-state.service';
import { PokemonBlackoutRecoveryService } from '#app/pokemon/blackout/pokemon-blackout-recovery.service';
import { PlayerRecoveryCheckpointRepository } from './world/player-recovery-checkpoint.repository';
import { PlayerRecoveryCheckpointService } from './world/player-recovery-checkpoint.service';
import { PokemonOverworldItemRepository } from '#app/pokemon/items/pokemon-overworld-item.repository';
import { PokemonProgressionManager } from '../pokemon/progression/pokemon-progression.manager';
import { PokemonPartyProgressionRepository } from '../pokemon/progression/pokemon-party-progression.repository';
import { PokemonPartyProgressionService } from '../pokemon/progression/pokemon-party-progression.service';
import { PokemonWildBattleProgressionService } from '../pokemon/battles/pokemon-wild-battle-progression.service';
import { PokemonTrainerStateStore } from '#app/pokemon/pokemon-trainer-state.store';
import { PokemonProgressionService } from '#app/pokemon/progression/pokemon-progression.service';
import { PokemonProgressionRepository } from '#app/pokemon/progression/pokemon-progression.repository';
import { PokemonProgressionOperationQueue } from '#app/pokemon/progression/pokemon-progression-operation.queue';
import { PokemonPendingMoveLearningRepository } from '#app/pokemon/progression/pokemon-pending-move-learning.repository';
import { PokemonPendingMoveLearningStore } from '#app/pokemon/progression/pokemon-pending-move-learning.store';
import { PokemonPendingMoveLearningService } from '#app/pokemon/progression/pokemon-pending-move-learning.service';
import { PokemonPendingEvolutionRepository } from '#app/pokemon/evolution/pokemon-pending-evolution.repository';
import { PokemonPendingEvolutionStore } from '#app/pokemon/evolution/pokemon-pending-evolution.store';
import { PokemonEvolutionDecisionService } from '#app/pokemon/evolution/pokemon-evolution-decision.service';
import { PokemonPendingEvolutionRecoveryService } from '#app/pokemon/evolution/pokemon-pending-evolution-recovery.service';
import { PokemonTrainerBattleProgressRepository } from '#app/pokemon/battles/pokemon-trainer-battle-progress.repository';
import { PokemonTrainerBattleVictoryService } from '#app/pokemon/battles/pokemon-trainer-battle-victory.service';

// accounts
import { AccountService } from '#app/account/account.service';
import { AccountRepository } from '#app/account/account.repository';
import { AccountTrainerService } from '#app/account/account-trainer.service';
import { AccountTrainerRepository } from '#app/account/account-trainer.repository';
import { AccountSessionService } from '#app/account/account-session.service';
import { AccountSessionRepository } from '#app/account/account-session.repository';
import { AccountAuthenticationService } from '#app/account/account-authentication.service';
import { AccountHttpController } from '#app/account/account-http.controller';

// google
import { GoogleIdentityService } from '#app/account/google/google-identity.service';
import { AccountGoogleLoginService } from '#app/account/google/account-google-login.service';
import { AccountRequestAuthenticationService } from '#app/account/account-request-authentication.service';
import { AccountTrainerHttpController } from '#app/account/account-trainer-http.controller';
import { AccountSocketAuthenticationService } from '#app/account/account-socket-authentication.service';

// login accounts (local)
import { PasswordHasherService } from '#app/account/local/password-hasher.service';
import { AccountPasswordCredentialRepository } from '#app/account/local/account-password.repository';
import { AccountLocalRegistrationService } from '#app/account/local/account-local-registration.service';
import { AccountLocalRegistrationRepository } from '#app/account/local/account-local-registration.repository';
import { AccountLocalLoginService } from '#app/account/local/account-local-login.service';
import { AccountLocalAuthController } from '#app/account/local/account-local-auth.controller';

// Pokemon center
import { PokemonCenterHealingRepository } from '#app/pokemon/healing/pokemon-center-healing.repository';
import { PokemonCenterHealingOperationQueue } from '#app/pokemon/healing/pokemon-center-healing-operation.queue';
import { PokemonCenterHealingService } from '#app/pokemon/healing/pokemon-center-healing.service';

// store
import { TrainerConnectionStore } from './player/trainer-connection.store';

// orchestator
import { GameGateway } from './game.gateway';

@Module({
  controllers: [
    AccountHttpController,
    AccountTrainerHttpController,
    AccountLocalAuthController,
  ],
  providers: [
    GameGateway,
    ChatService,
    PrismaService,
    PokemonPartyRepository,
    PokemonInventoryRepository,
    PokemonCaptureRepository,
    PokemonStorageRepository,
    PlayerWorldRuntimeStore,
    PlayerWorldLocationRepository,
    PlayerWorldStateService,
    PokemonBlackoutRecoveryService,
    PlayerRecoveryCheckpointRepository,
    PlayerRecoveryCheckpointService,
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
    PokemonPendingEvolutionRepository,
    PokemonPendingEvolutionStore,
    PokemonEvolutionDecisionService,
    PokemonPendingEvolutionRecoveryService,
    PokemonTrainerBattleProgressRepository,
    PokemonTrainerBattleVictoryService,
    AccountService,
    AccountRepository,
    AccountTrainerService,
    AccountTrainerRepository,
    AccountSessionService,
    AccountSessionRepository,
    AccountAuthenticationService,
    GoogleIdentityService,
    AccountGoogleLoginService,
    AccountRequestAuthenticationService,
    AccountSocketAuthenticationService,
    TrainerConnectionStore,
    PasswordHasherService,
    AccountPasswordCredentialRepository,
    AccountLocalRegistrationService,
    AccountLocalRegistrationRepository,
    AccountLocalLoginService,
    PokemonCenterHealingRepository,
    PokemonCenterHealingOperationQueue,
    PokemonCenterHealingService,
  ],
})
export class GameModule {}
