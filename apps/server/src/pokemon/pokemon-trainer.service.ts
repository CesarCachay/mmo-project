import type { PokemonTrainerState, PokemonStarterId } from '@cesar-mmo/shared';
import {
  addPokemonToParty,
  createPokemonInstance,
  POKEMON_STARTERS,
} from '@cesar-mmo/shared';

import type { PokemonTrainerId } from './pokemon-trainer-identity';

import { PokemonTrainerStateStore } from './pokemon-trainer-state.store.js';

export class PokemonTrainerService {
  private readonly trainerStateStore: PokemonTrainerStateStore;

  constructor(trainerStateStore: PokemonTrainerStateStore) {
    this.trainerStateStore = trainerStateStore;
  }

  public addPokemon(
    trainerId: PokemonTrainerId,
    speciesId: number,
    level: number,
  ): PokemonTrainerState {
    const trainerState = this.trainerStateStore.get(trainerId);

    if (!trainerState) {
      throw new Error(
        `Pokémon trainer state not found for trainer ${trainerId}`,
      );
    }

    const pokemon = createPokemonInstance(speciesId, level);
    const updatedParty = addPokemonToParty(trainerState.party, pokemon);
    return this.trainerStateStore.setParty(trainerId, updatedParty);
  }

  public chooseStarter(
    trainerId: PokemonTrainerId,
    starterId: PokemonStarterId,
  ): PokemonTrainerState {
    const trainerState = this.trainerStateStore.get(trainerId);

    if (!trainerState) {
      throw new Error(
        `Pokémon trainer state not found for trainer ${trainerId}`,
      );
    }

    if (trainerState.party.pokemon.length > 0) {
      throw new Error(
        `Player ${trainerId} already has a Pokémon and cannot choose a starter`,
      );
    }

    if (!this.trainerStateStore.isStarterSelectionUnlocked(trainerId)) {
      throw new Error(
        `Starter selection is not unlocked for trainer ${trainerId}`,
      );
    }

    const starter = POKEMON_STARTERS[starterId];
    const updatedTrainerState = this.addPokemon(
      trainerId,
      starter.speciesId,
      starter.level,
    );

    this.trainerStateStore.lockStarterSelection(trainerId);
    return updatedTrainerState;
  }
}
