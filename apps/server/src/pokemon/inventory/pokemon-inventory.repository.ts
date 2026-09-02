import { Injectable } from '@nestjs/common';

import {
  createPokemonInventory,
  isPokemonItemId,
  type PokemonInventory,
} from '@cesar-mmo/shared';

import { PrismaService } from '../../database/prisma.service';

import type { PokemonTrainerId } from '../pokemon-trainer-identity';

@Injectable()
export class PokemonInventoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async saveInventory(
    trainerId: PokemonTrainerId,
    inventory: PokemonInventory,
  ): Promise<void> {
    /*
     * Reutilizamos las invariantes del dominio:
     *
     * - quantities > 0
     * - no duplicate itemIds
     * - item stacks válidos
     */
    const validatedInventory = createPokemonInventory(inventory.items);

    await this.prisma.$transaction(async (tx) => {
      const trainer = await tx.pokemonTrainer.findUnique({
        where: {
          id: trainerId,
        },
        select: {
          id: true,
        },
      });

      if (!trainer) {
        throw new Error(`Pokémon trainer ${trainerId} does not exist`);
      }

      /*
       * Inventory es un snapshot pequeño.
       *
       * Reemplazar sus stacks dentro de una transaction
       * mantiene la operación simple y determinística.
       */
      await tx.pokemonTrainerInventoryItem.deleteMany({
        where: {
          trainerId,
        },
      });

      if (validatedInventory.items.length === 0) {
        return;
      }

      await tx.pokemonTrainerInventoryItem.createMany({
        data: validatedInventory.items.map((item) => ({
          trainerId,
          itemId: item.itemId,
          quantity: item.quantity,
        })),
      });
    });
  }

  async loadInventory(trainerId: PokemonTrainerId): Promise<PokemonInventory> {
    const rows = await this.prisma.pokemonTrainerInventoryItem.findMany({
      where: {
        trainerId,
      },
      orderBy: {
        itemId: 'asc',
      },
    });

    const items = rows.map((row) => {
      if (!isPokemonItemId(row.itemId)) {
        throw new Error(
          `Unknown Pokémon inventory item "${row.itemId}" persisted for trainer "${trainerId}"`,
        );
      }

      return {
        itemId: row.itemId,
        quantity: row.quantity,
      };
    });

    return createPokemonInventory(items);
  }
}
