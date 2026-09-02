import { createPokemonParty, createPokemonInventory } from '@cesar-mmo/shared';

import type { PokemonTrainerId } from './pokemon-trainer-identity';
import type {
  PokemonParty,
  PokemonTrainerState,
  PokemonInventory,
} from '@cesar-mmo/shared';

export class PokemonTrainerStateStore {
  private readonly trainerStates = new Map<
    PokemonTrainerId,
    PokemonTrainerState
  >();

  private readonly starterSelectionUnlocked = new Set<PokemonTrainerId>();

  create(
    trainerId: PokemonTrainerId,
    party: PokemonParty = createPokemonParty(),
    inventory: PokemonInventory = createPokemonInventory(),
  ): PokemonTrainerState {
    if (this.trainerStates.has(trainerId)) {
      throw new Error(`Trainer state already exists for trainer ${trainerId}`);
    }

    const trainerState: PokemonTrainerState = {
      party,
      inventory,
    };

    this.trainerStates.set(trainerId, trainerState);

    return trainerState;
  }

  get(trainerId: PokemonTrainerId): PokemonTrainerState | undefined {
    return this.trainerStates.get(trainerId);
  }

  setParty(
    trainerId: PokemonTrainerId,
    party: PokemonParty,
  ): PokemonTrainerState {
    const trainerState = this.trainerStates.get(trainerId);

    if (!trainerState) {
      throw new Error(`Trainer state not found for trainer ${trainerId}`);
    }
    const updatedTrainerState: PokemonTrainerState = {
      ...trainerState,
      party,
    };
    this.trainerStates.set(trainerId, updatedTrainerState);
    return updatedTrainerState;
  }

  setInventory(
    trainerId: PokemonTrainerId,
    inventory: PokemonInventory,
  ): PokemonTrainerState {
    const trainerState = this.trainerStates.get(trainerId);

    if (!trainerState) {
      throw new Error(`Trainer state not found for trainer ${trainerId}`);
    }

    const updatedTrainerState: PokemonTrainerState = {
      ...trainerState,
      inventory,
    };

    this.trainerStates.set(trainerId, updatedTrainerState);

    return updatedTrainerState;
  }

  has(trainerId: PokemonTrainerId): boolean {
    return this.trainerStates.has(trainerId);
  }

  remove(trainerId: PokemonTrainerId): void {
    this.trainerStates.delete(trainerId);
    this.starterSelectionUnlocked.delete(trainerId);
  }

  public clear(): void {
    this.trainerStates.clear();
    this.starterSelectionUnlocked.clear();
  }

  unlockStarterSelection(trainerId: PokemonTrainerId): void {
    this.starterSelectionUnlocked.add(trainerId);
  }

  isStarterSelectionUnlocked(trainerId: PokemonTrainerId): boolean {
    return this.starterSelectionUnlocked.has(trainerId);
  }

  lockStarterSelection(trainerId: PokemonTrainerId): void {
    this.starterSelectionUnlocked.delete(trainerId);
  }
}
