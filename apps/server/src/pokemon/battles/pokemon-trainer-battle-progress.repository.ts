import { Injectable } from '@nestjs/common';

import {
  addPokemonMoney,
  createPokemonInventory,
  createPokemonMoney,
  isPokemonItemId,
  isPokemonTrainerBattleId,
  isPokemonGymBadgeId,
  type PokemonInventory,
  type PokemonInventoryItemStack,
  type PokemonMoney,
  type PokemonTrainerBattleId,
  type PokemonGymBadgeId,
} from '@cesar-mmo/shared';

import { PrismaService } from '#app/database/prisma.service';
import type { PokemonTrainerId } from '../pokemon-trainer-identity';

export interface RecordPokemonTrainerBattleVictoryInput {
  readonly trainerId: PokemonTrainerId;
  readonly trainerBattleId: PokemonTrainerBattleId;
  readonly rewardItems: readonly PokemonInventoryItemStack[];
  readonly rewardMoney: PokemonMoney;
  readonly gymBadgeId?: PokemonGymBadgeId;
}

export interface RecordPokemonTrainerBattleVictoryResult {
  readonly firstVictory: boolean;
  readonly money: PokemonMoney;
  readonly inventory: PokemonInventory;
  /** Actual amount credited after applying the wallet cap. */
  readonly creditedMoney: PokemonMoney;
  readonly earnedGymBadgeIds: readonly PokemonGymBadgeId[];
  readonly awardedGymBadgeId?: PokemonGymBadgeId;
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

  public async loadEarnedGymBadgeIds(
    trainerId: PokemonTrainerId,
  ): Promise<readonly PokemonGymBadgeId[]> {
    const rows = await this.prisma.$queryRaw<Array<{ badgeId: string }>>`
      SELECT "badge_id" AS "badgeId"
      FROM "pokemon_trainer_gym_badges"
      WHERE "trainer_id" = CAST(${trainerId} AS uuid)
      ORDER BY "awarded_at" ASC, "badge_id" ASC
    `;

    return rows.map((row) => {
      if (!isPokemonGymBadgeId(row.badgeId)) {
        throw new Error(
          `Unknown Gym badge id "${row.badgeId}" persisted for trainer "${trainerId}"`,
        );
      }

      return row.badgeId;
    });
  }

  /**
   * Persists first-victory progress, Gym badge ownership, incremental item
   * rewards and money in one transaction. Wallet is always locked before inventory,
   * matching Poké Shop
   * BUY/SELL and preventing cross-feature wallet/inventory deadlocks.
   *
   * Rewards are applied incrementally in PostgreSQL instead of replacing an
   * inventory snapshot prepared from RAM. This prevents a concurrent durable
   * inventory mutation from being overwritten by a stale victory snapshot.
   */
  public async recordFirstVictory(
    input: RecordPokemonTrainerBattleVictoryInput,
  ): Promise<RecordPokemonTrainerBattleVictoryResult> {
    return this.prisma.$transaction(async (tx) => {
      const loadInventorySnapshot = async (): Promise<PokemonInventory> => {
        const rows = await tx.pokemonTrainerInventoryItem.findMany({
          where: { trainerId: input.trainerId },
          orderBy: { itemId: 'asc' },
          select: {
            itemId: true,
            quantity: true,
          },
        });

        return createPokemonInventory(
          rows.map((row) => {
            if (!isPokemonItemId(row.itemId)) {
              throw new Error(
                `Unknown Pokémon inventory item "${row.itemId}" persisted for trainer "${input.trainerId}"`,
              );
            }

            return {
              itemId: row.itemId,
              quantity: row.quantity,
            };
          }),
        );
      };

      const loadGymBadgeSnapshot = async (): Promise<
        readonly PokemonGymBadgeId[]
      > => {
        const rows = await tx.$queryRaw<Array<{ badgeId: string }>>`
          SELECT "badge_id" AS "badgeId"
          FROM "pokemon_trainer_gym_badges"
          WHERE "trainer_id" = CAST(${input.trainerId} AS uuid)
          ORDER BY "awarded_at" ASC, "badge_id" ASC
        `;

        return rows.map((row) => {
          if (!isPokemonGymBadgeId(row.badgeId)) {
            throw new Error(
              `Unknown Gym badge id "${row.badgeId}" persisted for trainer "${input.trainerId}"`,
            );
          }

          return row.badgeId;
        });
      };

      const walletRows = await tx.$queryRaw<Array<{ money: number }>>`
        SELECT "money"
        FROM "pokemon_trainers"
        WHERE "id" = CAST(${input.trainerId} AS uuid)
        LIMIT 1
        FOR UPDATE
      `;

      const walletRow = walletRows[0];

      if (!walletRow) {
        throw new Error(`Pokémon trainer ${input.trainerId} does not exist`);
      }

      const currentMoney = createPokemonMoney(walletRow.money);

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
        return {
          firstVictory: false,
          money: currentMoney,
          inventory: await loadInventorySnapshot(),
          creditedMoney: createPokemonMoney(0),
          earnedGymBadgeIds: await loadGymBadgeSnapshot(),
        };
      }

      await tx.pokemonTrainerBattleProgress.create({
        data: {
          trainerId: input.trainerId,
          trainerBattleId: input.trainerBattleId,
        },
      });

      let awardedGymBadgeId: PokemonGymBadgeId | undefined;

      if (input.gymBadgeId) {
        const awardedRows = await tx.$queryRaw<Array<{ badgeId: string }>>`
          INSERT INTO "pokemon_trainer_gym_badges" (
            "trainer_id",
            "badge_id"
          )
          VALUES (
            CAST(${input.trainerId} AS uuid),
            ${input.gymBadgeId}
          )
          ON CONFLICT ("trainer_id", "badge_id") DO NOTHING
          RETURNING "badge_id" AS "badgeId"
        `;

        const awardedRow = awardedRows[0];

        if (awardedRow) {
          if (!isPokemonGymBadgeId(awardedRow.badgeId)) {
            throw new Error(
              `Unknown Gym badge id "${awardedRow.badgeId}" returned while recording Trainer "${input.trainerId}" victory`,
            );
          }

          awardedGymBadgeId = awardedRow.badgeId;
        }
      }

      for (const rewardItem of input.rewardItems) {
        await tx.pokemonTrainerInventoryItem.upsert({
          where: {
            trainerId_itemId: {
              trainerId: input.trainerId,
              itemId: rewardItem.itemId,
            },
          },
          create: {
            trainerId: input.trainerId,
            itemId: rewardItem.itemId,
            quantity: rewardItem.quantity,
          },
          update: {
            quantity: {
              increment: rewardItem.quantity,
            },
          },
        });
      }

      const nextMoney = addPokemonMoney(currentMoney, input.rewardMoney);
      const creditedMoney = createPokemonMoney(nextMoney - currentMoney);

      const updatedWalletRows = await tx.$queryRaw<Array<{ money: number }>>`
        UPDATE "pokemon_trainers"
        SET "money" = ${nextMoney},
            "updated_at" = NOW()
        WHERE "id" = CAST(${input.trainerId} AS uuid)
        RETURNING "money"
      `;

      const updatedWalletRow = updatedWalletRows[0];

      if (!updatedWalletRow) {
        throw new Error(`Pokémon trainer ${input.trainerId} does not exist`);
      }

      return {
        firstVictory: true,
        money: createPokemonMoney(updatedWalletRow.money),
        inventory: await loadInventorySnapshot(),
        creditedMoney,
        earnedGymBadgeIds: await loadGymBadgeSnapshot(),
        ...(awardedGymBadgeId ? { awardedGymBadgeId } : {}),
      };
    });
  }

}
