import { Injectable } from '@nestjs/common';

import { MAX_POKEMON_PARTY_SIZE, type PokemonParty } from '@cesar-mmo/shared';

import { PrismaService } from '../database/prisma.service';

import type { PokemonTrainerId } from './pokemon-trainer-identity';

@Injectable()
export class PokemonPartyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async saveParty(
    trainerId: PokemonTrainerId,
    party: PokemonParty,
  ): Promise<void> {
    if (party.pokemon.length > MAX_POKEMON_PARTY_SIZE) {
      throw new Error(
        `Pokémon party cannot contain more than ${MAX_POKEMON_PARTY_SIZE} Pokémon`,
      );
    }

    const instanceIds = party.pokemon.map((pokemon) => pokemon.instanceId);

    if (new Set(instanceIds).size !== instanceIds.length) {
      throw new Error('Pokémon party contains duplicate instance ids');
    }

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
       * First clear the current active-party positions. We do NOT delete Pokémon here.
       * partyPosition = null means: trainer owns the Pokémon, but it is not currently in the active party.
       */
      await tx.pokemonInstance.updateMany({
        where: {
          trainerId,
          partyPosition: {
            not: null,
          },
        },
        data: {
          partyPosition: null,
        },
      });

      for (
        let partyPosition = 0;
        partyPosition < party.pokemon.length;
        partyPosition += 1
      ) {
        const pokemon = party.pokemon[partyPosition];

        if (!pokemon) {
          continue;
        }

        const existing = await tx.pokemonInstance.findUnique({
          where: {
            id: pokemon.instanceId,
          },
          select: {
            trainerId: true,
          },
        });

        if (existing && existing.trainerId !== trainerId) {
          throw new Error(
            `Pokémon instance ${pokemon.instanceId} belongs to another trainer`,
          );
        }

        const pokemonData = {
          speciesId: pokemon.speciesId,
          formId: pokemon.formId,
          nickname: pokemon.nickname ?? null,
          level: pokemon.level,
          experience: pokemon.experience,
          currentHp: pokemon.currentHp,
          abilityId: pokemon.abilityId,
          partyPosition,
        };

        if (existing) {
          await tx.pokemonInstance.update({
            where: {
              id: pokemon.instanceId,
            },
            data: pokemonData,
          });
        } else {
          await tx.pokemonInstance.create({
            data: {
              id: pokemon.instanceId,
              trainerId,
              ...pokemonData,
            },
          });
        }

        await tx.pokemonInstanceMove.deleteMany({
          where: {
            pokemonInstanceId: pokemon.instanceId,
          },
        });

        if (pokemon.moves.length > 0) {
          await tx.pokemonInstanceMove.createMany({
            data: pokemon.moves.map((move, slot) => ({
              pokemonInstanceId: pokemon.instanceId,
              slot,
              moveId: move.moveId,
              currentPp: move.currentPp,
            })),
          });
        }
      }
    });
  }

  async savePartyOrder(
    trainerId: PokemonTrainerId,
    orderedInstanceIds: readonly string[],
  ): Promise<void> {
    if (orderedInstanceIds.length > MAX_POKEMON_PARTY_SIZE) {
      throw new Error(
        `Pokémon party cannot contain more than ${MAX_POKEMON_PARTY_SIZE} Pokémon`,
      );
    }

    if (new Set(orderedInstanceIds).size !== orderedInstanceIds.length) {
      throw new Error('Pokémon party order contains duplicate instance ids');
    }

    await this.prisma.$transaction(async (tx) => {
      /*
       * La DB también valida el set actual.
       *
       * El reorder jamás debe:
       * - agregar Pokémon desde Storage
       * - remover Pokémon del Party
       * - cambiar ownership
       */
      const persistedParty = await tx.pokemonInstance.findMany({
        where: {
          trainerId,
          partyPosition: {
            not: null,
          },
        },
        select: {
          id: true,
        },
      });

      const persistedIds = persistedParty.map((pokemon) => pokemon.id);

      if (persistedIds.length !== orderedInstanceIds.length) {
        throw new Error(
          `Persisted Pokémon party does not match runtime party for trainer ${trainerId}`,
        );
      }

      const persistedIdSet = new Set(persistedIds);

      for (const instanceId of orderedInstanceIds) {
        if (!persistedIdSet.has(instanceId)) {
          throw new Error(
            `Pokémon instance ${instanceId} is not in the persisted active party`,
          );
        }
      }

      /*
       * Existe:
       * @@unique([trainerId, partyPosition])
       * Por eso no podemos cambiar:
       * 0 → 1
       * 1 → 0
       */
      await tx.pokemonInstance.updateMany({
        where: {
          trainerId,
          partyPosition: {
            not: null,
          },
        },
        data: {
          partyPosition: null,
        },
      });

      for (
        let partyPosition = 0;
        partyPosition < orderedInstanceIds.length;
        partyPosition += 1
      ) {
        const instanceId = orderedInstanceIds[partyPosition];

        if (!instanceId) {
          continue;
        }

        const result = await tx.pokemonInstance.updateMany({
          where: {
            id: instanceId,
            trainerId,
          },
          data: {
            partyPosition,
          },
        });

        if (result.count !== 1) {
          throw new Error(
            `Failed to persist party position for Pokémon ${instanceId}`,
          );
        }
      }
    });
  }

  async loadParty(trainerId: PokemonTrainerId): Promise<PokemonParty> {
    const pokemon = await this.prisma.pokemonInstance.findMany({
      where: {
        trainerId,
        partyPosition: {
          not: null,
        },
      },
      orderBy: {
        partyPosition: 'asc',
      },
      include: {
        moves: {
          orderBy: {
            slot: 'asc',
          },
        },
      },
    });

    return {
      pokemon: pokemon.map((entry) => ({
        instanceId: entry.id,
        speciesId: entry.speciesId,
        formId: entry.formId,

        ...(entry.nickname !== null
          ? {
              nickname: entry.nickname,
            }
          : {}),

        level: entry.level,
        experience: entry.experience,
        currentHp: entry.currentHp,
        abilityId: entry.abilityId,

        moves: entry.moves.map((move) => ({
          moveId: move.moveId,
          currentPp: move.currentPp,
        })),
      })),
    };
  }
}
