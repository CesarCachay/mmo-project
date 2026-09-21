import { Injectable } from '@nestjs/common';

import {
  createPokemonInventory,
  isPokemonItemId,
  type PokemonInventory,
  type PokemonInventoryItemStack,
  type PokemonInstance,
} from '@cesar-mmo/shared';

import { PrismaService } from '../database/prisma.service';
import type { PokemonTrainerId } from './pokemon-trainer-identity';

export interface PokemonStarterSelectionPersistenceInput {
  readonly trainerId: PokemonTrainerId;
  readonly starter: PokemonInstance;
  readonly rewardItems: readonly PokemonInventoryItemStack[];
}

export interface PokemonStarterSelectionPersistenceResult {
  readonly inventory: PokemonInventory;
}

@Injectable()
export class PokemonStarterSelectionRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async persistSelection(
    input: PokemonStarterSelectionPersistenceInput,
  ): Promise<PokemonStarterSelectionPersistenceResult> {
    return this.prisma.$transaction(async (tx) => {
      /*
       * Lock the Trainer row first. This follows the same economy lock order
       * used by Shop/Trainer rewards before touching inventory.
       */
      const trainerRows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "pokemon_trainers"
        WHERE "id" = CAST(${input.trainerId} AS uuid)
        LIMIT 1
        FOR UPDATE
      `;

      if (!trainerRows[0]) {
        throw new Error(`Pokémon trainer ${input.trainerId} does not exist`);
      }

      const activePartyCount = await tx.pokemonInstance.count({
        where: {
          trainerId: input.trainerId,
          partyPosition: {
            not: null,
          },
        },
      });

      if (activePartyCount > 0) {
        throw new Error(
          `Trainer ${input.trainerId} already has an active Pokémon and cannot choose a starter`,
        );
      }

      await tx.pokemonInstance.create({
        data: {
          id: input.starter.instanceId,
          trainerId: input.trainerId,
          speciesId: input.starter.speciesId,
          formId: input.starter.formId,
          nickname: input.starter.nickname ?? null,
          level: input.starter.level,
          experience: input.starter.experience,
          currentHp: input.starter.currentHp,
          abilityId: input.starter.abilityId,
          partyPosition: 0,
        },
      });

      if (input.starter.moves.length > 0) {
        await tx.pokemonInstanceMove.createMany({
          data: input.starter.moves.map((move, slot) => ({
            pokemonInstanceId: input.starter.instanceId,
            slot,
            moveId: move.moveId,
            currentPp: move.currentPp,
          })),
        });
      }

      for (const reward of input.rewardItems) {
        await tx.pokemonTrainerInventoryItem.upsert({
          where: {
            trainerId_itemId: {
              trainerId: input.trainerId,
              itemId: reward.itemId,
            },
          },
          create: {
            trainerId: input.trainerId,
            itemId: reward.itemId,
            quantity: reward.quantity,
          },
          update: {
            quantity: {
              increment: reward.quantity,
            },
          },
        });
      }

      const inventoryRows = await tx.pokemonTrainerInventoryItem.findMany({
        where: {
          trainerId: input.trainerId,
        },
        orderBy: {
          itemId: 'asc',
        },
      });

      return {
        inventory: createPokemonInventory(
          inventoryRows.map((row) => {
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
        ),
      };
    });
  }
}
