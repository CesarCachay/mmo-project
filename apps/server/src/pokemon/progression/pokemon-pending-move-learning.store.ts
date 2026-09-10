import { Injectable } from '@nestjs/common';

import type { PokemonTrainerId } from '../pokemon-trainer-identity';

import type { PokemonPendingMoveLearningState } from './pokemon-pending-move-learning.types';

@Injectable()
export class PokemonPendingMoveLearningStore {
  private readonly states = new Map<string, PokemonPendingMoveLearningState>();

  public getByPokemonInstanceId(
    pokemonInstanceId: string,
  ): PokemonPendingMoveLearningState | undefined {
    const state = this.states.get(pokemonInstanceId);

    return state ? cloneState(state) : undefined;
  }

  public set(state: PokemonPendingMoveLearningState): void {
    this.states.set(state.pokemonInstanceId, cloneState(state));
  }

  public remove(pokemonInstanceId: string): void {
    this.states.delete(pokemonInstanceId);
  }

  public removeTrainer(trainerId: PokemonTrainerId): void {
    for (const [pokemonInstanceId, state] of this.states.entries()) {
      if (state.trainerId === trainerId) {
        this.states.delete(pokemonInstanceId);
      }
    }
  }

  public clear(): void {
    this.states.clear();
  }
}

function cloneState(
  state: PokemonPendingMoveLearningState,
): PokemonPendingMoveLearningState {
  return {
    ...state,
    candidate: {
      ...state.candidate,
    },
    remainingCandidates: state.remainingCandidates.map((candidate) => ({
      ...candidate,
    })),
  };
}
