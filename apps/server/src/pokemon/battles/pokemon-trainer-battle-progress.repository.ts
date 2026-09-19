import { Injectable } from '@nestjs/common';

import {
  createPokemonInventory,
  isPokemonTrainerBattleId,
  type PokemonInventory,
  type PokemonTrainerBattleId,
} from '@cesar-mmo/shared';

import { PrismaService } from '../../database/prisma.service';
import type { PokemonTrainerId } from '../pokemon-trainer-identity';

export interface RecordPokemonTrainerBattleVictoryInput {
  readonly trainerId: PokemonTrainerId;
  readonly trainerBattleId: PokemonTrainerBattleId;
  readonly inventory: PokemonInventory;
}

@Injectable()
export class PokemonTrainerBattleProgressRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async loadDefeatedTrainerBattleIds(
    trainerId: PokemonTrainerId,
  ): Promise<readonly PokemonTrainerBattleId[]> {
    const rows = await this.prisma.pokemonTrainerBattleProgress.findMany({
      where: {
        trainerId,
      },
      orderBy: {
        defeatedAt: 'asc',
      },
      select: {
        trainerBattleId: true,
      },
    });

    return rows.map((row) => {
      if (!isPokemonTrainerBattleId(row.trainerBattleId)) {
        throw new Error(
          `Unknown Trainer Battle id "${row.trainerBattleId}" persisted for trainer "${trainerId}"`,
        );
      }

      return row.trainerBattleId;
    });
  }

  /**
   * Persists the first victory and the resulting inventory snapshot in one
   * transaction. Returns false when the Trainer Battle had already been won,
   * which prevents duplicate one-time rewards.
   */
  public async recordFirstVictory(
    input: RecordPokemonTrainerBattleVictoryInput,
  ): Promise<boolean> {
    const inventory = createPokemonInventory(input.inventory.items);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.pokemonTrainerBattleProgress.findUnique({
        where: {
          trainerId_trainerBattleId: {
            trainerId: input.trainerId,
            trainerBattleId: input.trainerBattleId,
          },
        },
        select: {
          trainerId: true,
        },
      });

      if (existing) {
        return false;
      }

      await tx.pokemonTrainerBattleProgress.create({
        data: {
          trainerId: input.trainerId,
          trainerBattleId: input.trainerBattleId,
        },
      });

      await tx.pokemonTrainerInventoryItem.deleteMany({
        where: {
          trainerId: input.trainerId,
        },
      });

      if (inventory.items.length > 0) {
        await tx.pokemonTrainerInventoryItem.createMany({
          data: inventory.items.map((item) => ({
            trainerId: input.trainerId,
            itemId: item.itemId,
            quantity: item.quantity,
          })),
        });
      }

      return true;
    });
  }
}
