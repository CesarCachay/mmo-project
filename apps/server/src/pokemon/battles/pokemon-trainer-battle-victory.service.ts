import { Injectable } from '@nestjs/common';

import {
  createPokemonMoney,
  getPokemonTrainerBattleDefinition,
  isPokemonTrainerBattleId,
  type PokemonInventoryItemStack,
  type PokemonMoney,
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
  /** Actual money credited. May be lower than configured when wallet is capped. */
  readonly rewardMoney: PokemonMoney;
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

    const persistenceResult = await this.progressRepository.recordFirstVictory({
      trainerId,
      trainerBattleId,
      rewardItems: definition.rewardItems,
      rewardMoney: definition.rewardMoney,
    });

    const persistedDefeatedIds = persistenceResult.firstVictory
      ? Array.from(
          new Set([
            ...(trainerState.defeatedTrainerBattleIds ?? []),
            trainerBattleId,
          ]),
        )
      : await this.progressRepository.loadDefeatedTrainerBattleIds(trainerId);

    /*
     * DB FIRST -> RAM SECOND. Use the inventory snapshot returned by the same
     * durable transaction, never a pre-transaction RAM-derived snapshot.
     */
    this.trainerStateStore.setInventoryAndMoney(
      trainerId,
      persistenceResult.inventory,
      persistenceResult.money,
    );

    const updatedTrainerState =
      this.trainerStateStore.setDefeatedTrainerBattleIds(
        trainerId,
        persistedDefeatedIds,
      );

    if (!persistenceResult.firstVictory) {
      return {
        firstVictory: false,
        trainerState: updatedTrainerState,
        rewardItems: [],
        rewardMoney: createPokemonMoney(0),
      };
    }

    return {
      firstVictory: true,
      trainerState: updatedTrainerState,
      rewardItems: definition.rewardItems,
      rewardMoney: persistenceResult.creditedMoney,
    };
  }
}
