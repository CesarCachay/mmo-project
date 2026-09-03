import { Injectable } from '@nestjs/common';

import {
  MAX_POKEMON_PARTY_SIZE,
  type PokemonInstance,
  type PokemonItemId,
} from '@cesar-mmo/shared';

import { PrismaService } from 'src/database/prisma.service';
import { PokemonTrainerId } from 'src/pokemon/pokemon-trainer-identity';

export interface PersistSuccessfulPokemonCaptureInput {
  readonly trainerId: PokemonTrainerId;
  readonly itemId: PokemonItemId;
  readonly capturedPokemon: PokemonInstance;

  /**
   * Derived from the authoritative TrainerState before persistence.
   * number → captured Pokémon must enter this Party slot.
   * null   → Party is full; Pokémon remains owned in Storage.
   */
  readonly expectedPartyPosition: number | null;
}

@Injectable()
export class PokemonCaptureRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async persistSuccessfulCapture(
    input: PersistSuccessfulPokemonCaptureInput,
  ): Promise<void> {
    const { trainerId, itemId, capturedPokemon, expectedPartyPosition } = input;

    if (
      expectedPartyPosition !== null &&
      (!Number.isInteger(expectedPartyPosition) ||
        expectedPartyPosition < 0 ||
        expectedPartyPosition >= MAX_POKEMON_PARTY_SIZE)
    ) {
      throw new Error(
        `Invalid expected Party position "${expectedPartyPosition}"`,
      );
    }

    if (capturedPokemon.moves.length > 4) {
      throw new Error(
        `Captured Pokémon "${capturedPokemon.instanceId}" cannot have more than 4 moves`,
      );
    }

    if (capturedPokemon.currentHp <= 0) {
      throw new Error(
        `Captured Pokémon "${capturedPokemon.instanceId}" must have positive HP`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      /*
       * 1. Trainer must still exist.
       */
      const trainer = await tx.pokemonTrainer.findUnique({
        where: {
          id: trainerId,
        },
        select: {
          id: true,
        },
      });

      if (!trainer) {
        throw new Error(`Pokémon trainer "${trainerId}" does not exist`);
      }

      /*
       * 2. Defensive Inventory validation INSIDE
       *    the same transaction.
       */
      const inventoryStack = await tx.pokemonTrainerInventoryItem.findUnique({
        where: {
          trainerId_itemId: {
            trainerId,
            itemId,
          },
        },
      });

      if (!inventoryStack || inventoryStack.quantity <= 0) {
        throw new Error(`Trainer "${trainerId}" has no "${itemId}" remaining`);
      }

      /*
       * 3. This Wild individual must not already be owned.
       *
       * We preserve the original Wild instanceId.
       */
      const existingPokemon = await tx.pokemonInstance.findUnique({
        where: {
          id: capturedPokemon.instanceId,
        },
        select: {
          id: true,
          trainerId: true,
        },
      });

      if (existingPokemon) {
        throw new Error(
          `Pokémon instance "${capturedPokemon.instanceId}" is already persisted`,
        );
      }

      /*
       * 4. Verify DB Party state still matches RAM expectation.
       *
       * Current Party persistence keeps positions contiguous
       * from 0..partySize-1.
       */
      const activePartyPokemon = await tx.pokemonInstance.findMany({
        where: {
          trainerId,
          partyPosition: {
            not: null,
          },
        },
        select: {
          partyPosition: true,
        },
        orderBy: {
          partyPosition: 'asc',
        },
      });

      const currentPartySize = activePartyPokemon.length;

      if (currentPartySize > MAX_POKEMON_PARTY_SIZE) {
        throw new Error(
          `Trainer "${trainerId}" has an invalid persisted Party size "${currentPartySize}"`,
        );
      }

      const databasePartyPosition =
        currentPartySize < MAX_POKEMON_PARTY_SIZE ? currentPartySize : null;

      if (databasePartyPosition !== expectedPartyPosition) {
        throw new Error(
          `Trainer "${trainerId}" Party state changed before capture persistence`,
        );
      }

      /*
       * 5. Consume the Poké Ball.
       *
       * quantity 1 → remove stack
       * quantity N → decrement
       */
      if (inventoryStack.quantity === 1) {
        await tx.pokemonTrainerInventoryItem.delete({
          where: {
            trainerId_itemId: {
              trainerId,
              itemId,
            },
          },
        });
      } else {
        await tx.pokemonTrainerInventoryItem.update({
          where: {
            trainerId_itemId: {
              trainerId,
              itemId,
            },
          },
          data: {
            quantity: {
              decrement: 1,
            },
          },
        });
      }

      /*
       * 6. Persist the SAME Pokémon that existed in the
       *    Wild Encounter / Battle.
       */
      await tx.pokemonInstance.create({
        data: {
          id: capturedPokemon.instanceId,
          trainerId,
          speciesId: capturedPokemon.speciesId,
          formId: capturedPokemon.formId,
          nickname: capturedPokemon.nickname ?? null,
          level: capturedPokemon.level,
          experience: capturedPokemon.experience,
          currentHp: capturedPokemon.currentHp,
          abilityId: capturedPokemon.abilityId,
          partyPosition: expectedPartyPosition,
        },
      });

      /*
       * 7. Persist current move + PP snapshot.
       */
      if (capturedPokemon.moves.length > 0) {
        await tx.pokemonInstanceMove.createMany({
          data: capturedPokemon.moves.map((move, slot) => ({
            pokemonInstanceId: capturedPokemon.instanceId,
            slot,
            moveId: move.moveId,
            currentPp: move.currentPp,
          })),
        });
      }
    });
  }
}
