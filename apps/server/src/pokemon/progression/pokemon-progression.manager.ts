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

import { PokemonEvolutionDecisionService } from '../evolution/pokemon-evolution-decision.service';

import type {
  ResolvePokemonEvolutionDecisionInput,
  ResolvePokemonEvolutionDecisionResult,
} from '../evolution/pokemon-evolution-decision.service';

@Injectable()
export class PokemonProgressionManager {
  constructor(
    private readonly progressionService: PokemonProgressionService,
    private readonly pendingMoveLearningService: PokemonPendingMoveLearningService,
    private readonly partyProgressionService: PokemonPartyProgressionService,
    private readonly evolutionDecisionService: PokemonEvolutionDecisionService,
  ) {}

  /*
   * --------------------------------------------------
   * Individual EXP / Rare Candy foundation
   * --------------------------------------------------
   */

  public applyExperience(
    input: ApplyPokemonExperienceInput,
  ): Promise<ApplyPokemonExperienceResult> {
    return this.progressionService.applyExperience(input);
  }

  /*
   * --------------------------------------------------
   * Pending Move Learning
   * --------------------------------------------------
   */

  public resolveMoveLearningDecision(
    input: ResolvePendingMoveLearningInput,
  ): Promise<ResolvePendingMoveLearningResult> {
    return this.pendingMoveLearningService.resolveDecision(input);
  }

  /*
   * --------------------------------------------------
   * Party / Battle EXP
   * --------------------------------------------------
   */

  public applyPartyExperience(
    input: ApplyPokemonPartyExperienceInput,
  ): Promise<ApplyPokemonPartyExperienceResult> {
    return this.partyProgressionService.applyPartyExperience(input);
  }

  /*
   * --------------------------------------------------
   * Pending Evolution
   * --------------------------------------------------
   */

  public resolveEvolutionDecision(
    input: ResolvePokemonEvolutionDecisionInput,
  ): Promise<ResolvePokemonEvolutionDecisionResult> {
    return this.evolutionDecisionService.resolveDecision(input);
  }
}
