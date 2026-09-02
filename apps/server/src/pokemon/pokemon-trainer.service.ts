import type {
  PokemonTrainerState,
  BattleParticipant,
  PokemonStarterId,
} from '@cesar-mmo/shared';
import {
  addPokemonToParty,
  createPokemonInstance,
  POKEMON_STARTERS,
  syncPokemonPartyFromBattleParticipant,
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

  public async syncBattleParticipantResult(
    trainerId: PokemonTrainerId,
    trainerParticipant: BattleParticipant,
  ): Promise<PokemonTrainerState> {
    const trainerState = this.trainerStateStore.get(trainerId);

    if (!trainerState) {
      throw new Error(
        `Pokémon Trainer state not found for Trainer "${trainerId}" while synchronizing Battle result`,
      );
    }

    const updatedParty = syncPokemonPartyFromBattleParticipant(
      trainerState.party,
      trainerParticipant,
    );

    // Persist FIRST.
    // If PostgreSQL fails, RAM remains unchanged.
    await this.pokemonPartyRepository.saveParty(trainerId, updatedParty);

    // Only after durable persistence succeeds do we update runtime Trainer state.
    return this.trainerStateStore.setParty(trainerId, updatedParty);
  }

  // TO REMOVE - TEST
  public async ensureDevelopmentBattleTestParty(
    trainerId: PokemonTrainerId,
  ): Promise<PokemonTrainerState> {
    const trainerState = this.trainerStateStore.get(trainerId);

    if (!trainerState) {
      throw new Error(
        `Pokémon trainer state not found for trainer ${trainerId}`,
      );
    }

    /*
     * Protección importante:
     * este seed JAMÁS debe ejecutarse
     * accidentalmente en producción.
     */
    if (process.env.NODE_ENV === 'production') {
      return trainerState;
    }
    const hasLatios = trainerState.party.pokemon.some(
      (pokemon) => pokemon.speciesId === 381,
    );
    const hasLarvitar = trainerState.party.pokemon.some(
      (pokemon) => pokemon.speciesId === 246,
    );
    let updatedState = trainerState;

    if (!hasLatios) {
      updatedState = await this.addPokemon(trainerId, 381, 10);
    }
    if (!hasLarvitar) {
      updatedState = await this.addPokemon(trainerId, 246, 7);
    }

    return updatedState;
  }
}
