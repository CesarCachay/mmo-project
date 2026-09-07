import { Injectable } from '@nestjs/common';

import type { PokemonItemId } from '@cesar-mmo/shared';

import { PrismaService } from '../../database/prisma.service';

import type { PokemonTrainerId } from '../pokemon-trainer-identity';

export type PokemonOverworldItemPersistenceConflictCode =
  'ITEM_NOT_AVAILABLE' | 'INVALID_TARGET';

export class PokemonOverworldItemPersistenceConflictError extends Error {
  constructor(
    public readonly code: PokemonOverworldItemPersistenceConflictCode,
    message: string,
  ) {
    super(message);
    this.name = 'PokemonOverworldItemPersistenceConflictError';
  }
}

export interface ApplyPokemonOverworldHealingInput {
  readonly trainerId: PokemonTrainerId;
  readonly itemId: PokemonItemId;
  readonly targetPokemonInstanceId: string;
  readonly currentHp: number;
}

@Injectable()
export class PokemonOverworldItemRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async applyHealing(
    input: ApplyPokemonOverworldHealingInput,
  ): Promise<void> {
    const { trainerId, itemId, targetPokemonInstanceId, currentHp } = input;

    await this.prisma.$transaction(async (tx) => {
      /*
       * 1. Consume exactamente un item.
       * updateMany + quantity > 0 evita que
       * dos requests puedan consumir el mismo
       * último item.
       */
      const consumed = await tx.pokemonTrainerInventoryItem.updateMany({
        where: {
          trainerId,
          itemId,
          quantity: {
            gt: 0,
          },
        },

        data: {
          quantity: {
            decrement: 1,
          },
        },
      });

      if (consumed.count !== 1) {
        throw new PokemonOverworldItemPersistenceConflictError(
          'ITEM_NOT_AVAILABLE',
          `Pokémon item "${itemId}" is not available for trainer "${trainerId}"`,
        );
      }

      /*
       * 2. El target debe:
       * - pertenecer al Trainer;
       * - existir;
       * - estar actualmente en Party.
       */
      const healed = await tx.pokemonInstance.updateMany({
        where: {
          id: targetPokemonInstanceId,
          trainerId,
          partyPosition: {
            not: null,
          },
        },
        data: {
          currentHp,
        },
      });

      if (healed.count !== 1) {
        /* Throw dentro de $transaction: también revierte el decrement anterior del item */
        throw new PokemonOverworldItemPersistenceConflictError(
          'INVALID_TARGET',
          `Pokémon "${targetPokemonInstanceId}" is not an active Party Pokémon for trainer "${trainerId}"`,
        );
      }

      /* 3. Nuestro domain no conserva stacks con quantity = 0 */
      await tx.pokemonTrainerInventoryItem.deleteMany({
        where: {
          trainerId,
          itemId,
          quantity: 0,
        },
      });
    });
  }
}
