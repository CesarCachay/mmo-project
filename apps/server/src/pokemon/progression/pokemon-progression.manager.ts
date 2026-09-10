import { Injectable } from '@nestjs/common';

import { PokemonProgressionService } from './pokemon-progression.service';

import type {
  ApplyPokemonExperienceInput,
  ApplyPokemonExperienceResult,
} from './pokemon-progression.service';

import { PokemonPendingMoveLearningService } from './pokemon-pending-move-learning.service';

import type {
  ResolvePendingMoveLearningInput,
  ResolvePendingMoveLearningResult,
} from './pokemon-pending-move-learning.service';

import { PokemonPartyProgressionService } from './pokemon-party-progression.service';

import type {
  ApplyPokemonPartyExperienceInput,
  ApplyPokemonPartyExperienceResult,
} from './pokemon-party-progression.service';

@Injectable()
export class PokemonProgressionManager {
  constructor(
    private readonly progressionService: PokemonProgressionService,
    private readonly pendingMoveLearningService: PokemonPendingMoveLearningService,
    private readonly partyProgressionService: PokemonPartyProgressionService,
  ) {}

  public applyExperience(
    input: ApplyPokemonExperienceInput,
  ): Promise<ApplyPokemonExperienceResult> {
    return this.progressionService.applyExperience(input);
  }

  public resolveMoveLearningDecision(
    input: ResolvePendingMoveLearningInput,
  ): Promise<ResolvePendingMoveLearningResult> {
    return this.pendingMoveLearningService.resolveDecision(input);
  }

  public applyPartyExperience(
    input: ApplyPokemonPartyExperienceInput,
  ): Promise<ApplyPokemonPartyExperienceResult> {
    return this.partyProgressionService.applyPartyExperience(input);
  }
}
