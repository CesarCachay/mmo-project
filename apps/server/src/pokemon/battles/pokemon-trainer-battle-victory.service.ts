import { Injectable } from '@nestjs/common';

import {
  createPokemonMoney,
  getPokemonTrainerBattleDefinition,
  getPokemonGymBadgeDefinition,
  isPokemonTrainerBattleId,
  type PokemonInventoryItemStack,
  type PokemonMoney,
  type PokemonTrainerBattleId,
  type PokemonTrainerState,
  type PokemonGymBadgeAward,
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
  readonly gymBadgeAward?: PokemonGymBadgeAward;
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

  public loadEarnedGymBadgeIds(trainerId: PokemonTrainerId) {
    return this.progressRepository.loadEarnedGymBadgeIds(trainerId);
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
      ...(definition.category === 'gym-leader' && definition.gymLeader
        ? { gymBadgeId: definition.gymLeader.badgeId }
        : {}),
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
     * DB FIRST -> RAM SECOND. Inventory, money, defeated-Trainer progress and
     * Gym badges are adopted from the durable transaction as one RAM snapshot.
     */
    const updatedTrainerState =
      this.trainerStateStore.setBattleVictoryProgress(trainerId, {
        inventory: persistenceResult.inventory,
        money: persistenceResult.money,
        defeatedTrainerBattleIds: persistedDefeatedIds,
        earnedGymBadgeIds: persistenceResult.earnedGymBadgeIds,
      });

    if (!persistenceResult.firstVictory) {
      return {
        firstVictory: false,
        trainerState: updatedTrainerState,
        rewardItems: [],
        rewardMoney: createPokemonMoney(0),
      };
    }

    const gymBadgeAward = persistenceResult.awardedGymBadgeId
      ? getPokemonGymBadgeDefinition(persistenceResult.awardedGymBadgeId)
      : undefined;

    return {
      firstVictory: true,
      trainerState: updatedTrainerState,
      rewardItems: definition.rewardItems,
      rewardMoney: persistenceResult.creditedMoney,
      ...(gymBadgeAward
        ? {
            gymBadgeAward: {
              badgeId: gymBadgeAward.id,
              displayName: gymBadgeAward.displayName,
            },
          }
        : {}),
    };
  }
}
