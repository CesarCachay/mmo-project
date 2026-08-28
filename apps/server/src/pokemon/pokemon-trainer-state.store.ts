import { createPokemonParty } from '@cesar-mmo/shared';

import type { PokemonParty, PokemonTrainerState } from '@cesar-mmo/shared';

export class PokemonTrainerStateStore {
  private readonly trainerStates = new Map<string, PokemonTrainerState>();

  private readonly starterSelectionUnlockedPlayerIds = new Set<string>();

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

  public remove(playerId: string): void {
    this.trainerStates.delete(playerId);
    this.starterSelectionUnlockedPlayerIds.delete(playerId);
  }

  public clear(): void {
    this.trainerStates.clear();
    this.starterSelectionUnlockedPlayerIds.clear();
  }

  public unlockStarterSelection(playerId: string): void {
    if (!this.trainerStates.has(playerId)) {
      throw new Error(`Pokémon trainer state not found for player ${playerId}`);
    }

    this.starterSelectionUnlockedPlayerIds.add(playerId);
  }

  public isStarterSelectionUnlocked(playerId: string): boolean {
    return this.starterSelectionUnlockedPlayerIds.has(playerId);
  }

  public lockStarterSelection(playerId: string): void {
    this.starterSelectionUnlockedPlayerIds.delete(playerId);
  }
}
