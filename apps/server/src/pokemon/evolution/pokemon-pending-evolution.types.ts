import type { PokemonTrainerId } from '../pokemon-trainer-identity';

export interface PokemonPendingEvolutionState {
  readonly trainerId: PokemonTrainerId;

  readonly pokemonInstanceId: string;

  readonly sourceSpeciesId: number;
  readonly sourceFormId: number;

  readonly targetSpeciesId: number;
  readonly targetFormId: number;

  readonly triggerLevel: number;

  readonly revision: number;
}

export interface PokemonPendingEvolutionCreation {
  readonly sourceSpeciesId: number;
  readonly sourceFormId: number;

  readonly targetSpeciesId: number;
  readonly targetFormId: number;

  readonly triggerLevel: number;
}
