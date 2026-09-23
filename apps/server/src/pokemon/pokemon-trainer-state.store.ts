import { Injectable } from '@nestjs/common';
import {
  createPokemonParty,
  createPokemonInventory,
  createPokemonMoney,
  type PokemonMoney,
  type PokemonGymBadgeId,
} from '@cesar-mmo/shared';

import type { PokemonTrainerId } from './pokemon-trainer-identity';
import type {
  PokemonParty,
  PokemonTrainerState,
  PokemonInventory,
} from '@cesar-mmo/shared';

@Injectable()
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
    defeatedTrainerBattleIds: readonly string[] = [],
    money: PokemonMoney = createPokemonMoney(),
    earnedGymBadgeIds: readonly PokemonGymBadgeId[] = [],
  ): PokemonTrainerState {
    if (this.trainerStates.has(trainerId)) {
      throw new Error(`Trainer state already exists for trainer ${trainerId}`);
    }

    const trainerState: PokemonTrainerState = {
      party,
      inventory,
      money: createPokemonMoney(money),
      defeatedTrainerBattleIds: [...new Set(defeatedTrainerBattleIds)],
      earnedGymBadgeIds: [...new Set(earnedGymBadgeIds)],
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


  setDefeatedTrainerBattleIds(
    trainerId: PokemonTrainerId,
    defeatedTrainerBattleIds: readonly string[],
  ): PokemonTrainerState {
    const trainerState = this.trainerStates.get(trainerId);

    if (!trainerState) {
      throw new Error(`Trainer state not found for trainer ${trainerId}`);
    }

    const updatedTrainerState: PokemonTrainerState = {
      ...trainerState,
      defeatedTrainerBattleIds: [...new Set(defeatedTrainerBattleIds)],
    };

    this.trainerStates.set(trainerId, updatedTrainerState);

    return updatedTrainerState;
  }

  setBattleVictoryProgress(
    trainerId: PokemonTrainerId,
    input: {
      readonly inventory: PokemonInventory;
      readonly money: PokemonMoney;
      readonly defeatedTrainerBattleIds: readonly string[];
      readonly earnedGymBadgeIds: readonly PokemonGymBadgeId[];
    },
  ): PokemonTrainerState {
    const trainerState = this.trainerStates.get(trainerId);

    if (!trainerState) {
      throw new Error(`Trainer state not found for trainer ${trainerId}`);
    }

    const updatedTrainerState: PokemonTrainerState = {
      ...trainerState,
      inventory: input.inventory,
      money: createPokemonMoney(input.money),
      defeatedTrainerBattleIds: [...new Set(input.defeatedTrainerBattleIds)],
      earnedGymBadgeIds: [...new Set(input.earnedGymBadgeIds)],
    };

    this.trainerStates.set(trainerId, updatedTrainerState);

    return updatedTrainerState;
  }

  setMoney(
    trainerId: PokemonTrainerId,
    money: PokemonMoney,
  ): PokemonTrainerState {
    const trainerState = this.trainerStates.get(trainerId);

    if (!trainerState) {
      throw new Error(`Trainer state not found for trainer ${trainerId}`);
    }

    const updatedTrainerState: PokemonTrainerState = {
      ...trainerState,
      money: createPokemonMoney(money),
    };

    this.trainerStates.set(trainerId, updatedTrainerState);

    return updatedTrainerState;
  }

  setInventoryAndMoney(
    trainerId: PokemonTrainerId,
    inventory: PokemonInventory,
    money: PokemonMoney,
  ): PokemonTrainerState {
    const trainerState = this.trainerStates.get(trainerId);

    if (!trainerState) {
      throw new Error(`Trainer state not found for trainer ${trainerId}`);
    }

    const updatedTrainerState: PokemonTrainerState = {
      ...trainerState,
      inventory,
      money: createPokemonMoney(money),
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

  setPartyAndInventory(
    trainerId: PokemonTrainerId,
    party: PokemonParty,
    inventory: PokemonInventory,
  ): PokemonTrainerState {
    const trainerState = this.trainerStates.get(trainerId);

    if (!trainerState) {
      throw new Error(`Trainer state not found for trainer ${trainerId}`);
    }

    const updatedTrainerState: PokemonTrainerState = {
      ...trainerState,
      party,
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
