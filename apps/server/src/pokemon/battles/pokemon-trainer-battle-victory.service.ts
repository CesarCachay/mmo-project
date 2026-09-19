import { Injectable } from '@nestjs/common';

import {
  addPokemonInventoryItem,
  getPokemonTrainerBattleDefinition,
  isPokemonTrainerBattleId,
  type PokemonInventoryItemStack,
  type PokemonTrainerBattleId,
  type PokemonTrainerState,
} from '@cesar-mmo/shared';

import type { PokemonTrainerId } from '../pokemon-trainer-identity';
import { PokemonTrainerStateStore } from '../pokemon-trainer-state.store';
import { PokemonTrainerBattleProgressRepository } from './pokemon-trainer-battle-progress.repository';

export interface PokemonTrainerBattleVictoryResult {
  readonly firstVictory: boolean;
  readonly trainerState: PokemonTrainerState;
  readonly rewardItems: readonly PokemonInventoryItemStack[];
}

@Injectable()
export class PokemonTrainerBattleVictoryService {
  constructor(
    private readonly progressRepository: PokemonTrainerBattleProgressRepository,
    private readonly trainerStateStore: PokemonTrainerStateStore,
  ) {}

  public loadDefeatedTrainerBattleIds(
    trainerId: PokemonTrainerId,
  ): Promise<readonly PokemonTrainerBattleId[]> {
    return this.progressRepository.loadDefeatedTrainerBattleIds(trainerId);
  }

  public isDefeated(
    trainerState: PokemonTrainerState,
    trainerBattleId: string,
  ): boolean {
    if (!isPokemonTrainerBattleId(trainerBattleId)) {
      return false;
    }

    return (trainerState.defeatedTrainerBattleIds ?? []).includes(
      trainerBattleId,
    );
  }

  public async recordVictory(
    trainerId: PokemonTrainerId,
    trainerBattleId: PokemonTrainerBattleId,
  ): Promise<PokemonTrainerBattleVictoryResult> {
    const trainerState = this.trainerStateStore.get(trainerId);

    if (!trainerState) {
      throw new Error(
        `Pokémon Trainer state not found for Trainer "${trainerId}" while recording Trainer Battle victory`,
      );
    }

    const definition = getPokemonTrainerBattleDefinition(trainerBattleId);

    let rewardedInventory = trainerState.inventory;

    for (const rewardItem of definition.rewardItems) {
      rewardedInventory = addPokemonInventoryItem(
        rewardedInventory,
        rewardItem.itemId,
        rewardItem.quantity,
      );
    }

    const firstVictory = await this.progressRepository.recordFirstVictory({
      trainerId,
      trainerBattleId,
      inventory: rewardedInventory,
    });

    if (!firstVictory) {
      const persistedDefeatedIds =
        await this.progressRepository.loadDefeatedTrainerBattleIds(trainerId);

      const reconciledState = this.trainerStateStore.setDefeatedTrainerBattleIds(
        trainerId,
        persistedDefeatedIds,
      );

      return {
        firstVictory: false,
        trainerState: reconciledState,
        rewardItems: [],
      };
    }

    this.trainerStateStore.setInventory(trainerId, rewardedInventory);

    const defeatedIds = Array.from(
      new Set([
        ...(trainerState.defeatedTrainerBattleIds ?? []),
        trainerBattleId,
      ]),
    );

    const updatedTrainerState =
      this.trainerStateStore.setDefeatedTrainerBattleIds(
        trainerId,
        defeatedIds,
      );

    return {
      firstVictory: true,
      trainerState: updatedTrainerState,
      rewardItems: definition.rewardItems,
    };
  }
}
