import type { PokemonLevelUpMoveCandidate } from '@cesar-mmo/shared';

import type { PokemonTrainerId } from '../pokemon-trainer-identity';

export interface PokemonPendingMoveLearningCandidate {
  readonly moveId: number;
  readonly learnedAtLevel: number;
}

export interface PokemonPendingMoveLearningState {
  readonly trainerId: PokemonTrainerId;
  readonly pokemonInstanceId: string;
  readonly candidate: PokemonPendingMoveLearningCandidate;
  readonly remainingCandidates: readonly PokemonPendingMoveLearningCandidate[];
  readonly revision: number;
}

export function toPendingMoveLearningCandidate(
  candidate: PokemonLevelUpMoveCandidate,
): PokemonPendingMoveLearningCandidate {
  return {
    moveId: candidate.moveId,
    learnedAtLevel: candidate.learnedAtLevel,
  };
}
