import type { PokemonTrainerState, PokemonStarterId } from '@cesar-mmo/shared';
import {
  addPokemonToParty,
  createPokemonInstance,
  POKEMON_STARTERS,
} from '@cesar-mmo/shared';

import type { PokemonTrainerId } from './pokemon-trainer-identity';

import { PokemonTrainerStateStore } from './pokemon-trainer-state.store.js';

import { PokemonPartyRepository } from './pokemon-party.repository';

export class PokemonTrainerService {
  constructor(
    private readonly trainerStateStore: PokemonTrainerStateStore,
    private readonly pokemonPartyRepository: PokemonPartyRepository,
  ) {
    this.trainerStateStore = trainerStateStore;
  }

  public async addPokemon(
    trainerId: PokemonTrainerId,
    speciesId: number,
    level: number,
  ): Promise<PokemonTrainerState> {
    const trainerState = this.trainerStateStore.get(trainerId);

    if (!trainerState) {
      throw new Error(
        `Pokémon trainer state not found for trainer ${trainerId}`,
      );
    }

    const pokemon = createPokemonInstance(speciesId, level);
    const updatedParty = addPokemonToParty(trainerState.party, pokemon);

    /* Persistimos primero. Si PostgreSQL falla, NO modificamos el estado runtime. */
    await this.pokemonPartyRepository.saveParty(trainerId, updatedParty);
    return this.trainerStateStore.setParty(trainerId, updatedParty);
  }

  public async chooseStarter(
    trainerId: PokemonTrainerId,
    starterId: PokemonStarterId,
  ): Promise<PokemonTrainerState> {
    const trainerState = this.trainerStateStore.get(trainerId);

    if (!trainerState) {
      throw new Error(
        `Pokémon trainer state not found for trainer ${trainerId}`,
      );
    }

    if (trainerState.party.pokemon.length > 0) {
      throw new Error(
        `Trainer ${trainerId} already has a Pokémon and cannot choose a starter`,
      );
    }

    if (!this.trainerStateStore.isStarterSelectionUnlocked(trainerId)) {
      throw new Error(
        `Starter selection is not unlocked for trainer ${trainerId}`,
      );
    }

    const starter = POKEMON_STARTERS[starterId];

    /* Bloqueamos ANTES del await para evitar dos elecciones concurrentes. */
    this.trainerStateStore.lockStarterSelection(trainerId);

    try {
      return await this.addPokemon(trainerId, starter.speciesId, starter.level);
    } catch (error: unknown) {
      /* Si falla PostgreSQL permitimos que el jugador reintente. */
      this.trainerStateStore.unlockStarterSelection(trainerId);
      throw error;
    }
  }
}
