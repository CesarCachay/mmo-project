import type { PokemonTrainerId } from './pokemon-trainer-identity';

export interface PokemonTrainerRecord {
  trainerId: PokemonTrainerId;
  createdAt: Date;
  updatedAt: Date;
}
