import type { PokemonTrainerState, PokemonStarterId } from '@cesar-mmo/shared';
import {
  addPokemonToParty,
  createPokemonInstance,
  POKEMON_STARTERS,
} from '@cesar-mmo/shared';

import { PokemonTrainerStateStore } from './pokemon-trainer-state.store.js';

export class PokemonTrainerService {
  private readonly trainerStateStore: PokemonTrainerStateStore;

  constructor(trainerStateStore: PokemonTrainerStateStore) {
    this.trainerStateStore = trainerStateStore;
  }

  public addPokemon(
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

  public chooseStarter(
    playerId: string,
    starterId: PokemonStarterId,
  ): PokemonTrainerState {
    const trainerState = this.trainerStateStore.get(playerId);

    if (!trainerState) {
      throw new Error(`Pokémon trainer state not found for player ${playerId}`);
    }

    if (trainerState.party.pokemon.length > 0) {
      throw new Error(
        `Player ${playerId} already has a Pokémon and cannot choose a starter`,
      );
    }

    if (!this.trainerStateStore.isStarterSelectionUnlocked(playerId)) {
      throw new Error(
        `Starter selection is not unlocked for player ${playerId}`,
      );
    }

    const starter = POKEMON_STARTERS[starterId];
    const updatedTrainerState = this.addPokemon(
      playerId,
      starter.speciesId,
      starter.level,
    );

    this.trainerStateStore.lockStarterSelection(playerId);
    return updatedTrainerState;
  }
}
