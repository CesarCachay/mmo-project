import { createPokemonParty } from '@cesar-mmo/shared';

import type { PokemonParty, PokemonTrainerState } from '@cesar-mmo/shared';

export class PokemonTrainerStateStore {
  private readonly trainerStates = new Map<string, PokemonTrainerState>();

  create(playerId: string): PokemonTrainerState {
    if (this.trainerStates.has(playerId)) {
      throw new Error(
        `Pokémon trainer state already exists for player ${playerId}`,
      );
    }

    const trainerState: PokemonTrainerState = {
      party: createPokemonParty(),
    };

    this.trainerStates.set(playerId, trainerState);

    return trainerState;
  }

  get(playerId: string): PokemonTrainerState | undefined {
    return this.trainerStates.get(playerId);
  }

  setParty(playerId: string, party: PokemonParty): PokemonTrainerState {
    const trainerState = this.trainerStates.get(playerId);

    if (!trainerState) {
      throw new Error(`Pokémon trainer state not found for player ${playerId}`);
    }

    const updatedTrainerState: PokemonTrainerState = {
      ...trainerState,
      party,
    };

    this.trainerStates.set(playerId, updatedTrainerState);

    return updatedTrainerState;
  }

  has(playerId: string): boolean {
    return this.trainerStates.has(playerId);
  }

  remove(playerId: string): void {
    this.trainerStates.delete(playerId);
  }

  clear(): void {
    this.trainerStates.clear();
  }
}
