import type { PokemonTrainerState } from '@cesar-mmo/shared';
import { addPokemonToParty, createPokemonInstance } from '@cesar-mmo/shared';

import { PokemonTrainerStateStore } from './pokemon-trainer-state.store.js';

export class PokemonTrainerService {
  private readonly trainerStateStore: PokemonTrainerStateStore;

  constructor(trainerStateStore: PokemonTrainerStateStore) {
    this.trainerStateStore = trainerStateStore;
  }

  addPokemon(
    playerId: string,
    speciesId: number,
    level: number,
  ): PokemonTrainerState {
    const trainerState = this.trainerStateStore.get(playerId);

    if (!trainerState) {
      throw new Error(`Pokémon trainer state not found for player ${playerId}`);
    }

    const pokemon = createPokemonInstance(speciesId, level);

    const updatedParty = addPokemonToParty(trainerState.party, pokemon);

    return this.trainerStateStore.setParty(playerId, updatedParty);
  }
}
