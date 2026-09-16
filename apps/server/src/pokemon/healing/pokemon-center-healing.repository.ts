import { Injectable } from '@nestjs/common';

import type { PokemonParty } from '@cesar-mmo/shared';

import { PrismaService } from '../../database/prisma.service';

import type { PokemonTrainerId } from '../pokemon-trainer-identity';

export type PokemonCenterHealingPersistenceConflictCode =
  'PARTY_STATE_CHANGED' | 'POKEMON_STATE_CHANGED' | 'MOVE_STATE_CHANGED';

export class PokemonCenterHealingPersistenceConflictError extends Error {
  constructor(
    public readonly code: PokemonCenterHealingPersistenceConflictCode,
    message: string,
  ) {
    super(message);
    this.name = 'PokemonCenterHealingPersistenceConflictError';
  }
}

export interface ApplyPokemonCenterHealingInput {
  readonly trainerId: PokemonTrainerId;
  readonly expectedParty: PokemonParty;
  readonly healedParty: PokemonParty;
}

interface PersistedPartyPokemon {
  readonly id: string;
  readonly speciesId: number;
  readonly formId: number;
  readonly level: number;
  readonly currentHp: number;

  readonly moves: readonly {
    readonly slot: number;
    readonly moveId: number;
    readonly currentPp: number;
  }[];
}

@Injectable()
export class PokemonCenterHealingRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async applyHealing(
    input: ApplyPokemonCenterHealingInput,
  ): Promise<void> {
    const { trainerId, expectedParty, healedParty } = input;

    assertHealingPartyShape(expectedParty, healedParty);

    await this.prisma.$transaction(async (tx) => {
      /*
       * Preflight antes de realizar la primera escritura.
       *
       * Pokémon Center healing afecta a todo el Party ACTIVO.
       * Por eso verificamos que PostgreSQL todavía represente
       * el mismo Party usado para generar el healing plan.
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
          speciesId: true,
          formId: true,
          level: true,
          currentHp: true,
          moves: {
            orderBy: {
              slot: 'asc',
            },
            select: {
              slot: true,
              moveId: true,
              currentPp: true,
            },
          },
        },
      });

      assertPersistedPartyMatchesExpected(
        trainerId,
        expectedParty,
        persistedParty,
      );

      const healedByInstanceId = new Map(
        healedParty.pokemon.map((pokemon) => [pokemon.instanceId, pokemon]),
      );

      /*
       * DB FIRST.
       *
       * Este repository únicamente puede modificar:
       *
       * PokemonInstance.currentHp
       * PokemonInstanceMove.currentPp
       *
       * Los valores actuales también forman parte del WHERE.
       * Eso funciona como optimistic concurrency guard.
       */
      for (const expectedPokemon of expectedParty.pokemon) {
        const healedPokemon = healedByInstanceId.get(
          expectedPokemon.instanceId,
        );

        if (!healedPokemon) {
          throw new Error(
            `Healing plan is missing Pokémon "${expectedPokemon.instanceId}"`,
          );
        }

        const updatedPokemon = await tx.pokemonInstance.updateMany({
          where: {
            id: expectedPokemon.instanceId,
            trainerId,
            partyPosition: {
              not: null,
            },
            speciesId: expectedPokemon.speciesId,
            formId: expectedPokemon.formId,
            level: expectedPokemon.level,
            currentHp: expectedPokemon.currentHp,
          },
          data: {
            currentHp: healedPokemon.currentHp,
          },
        });

        if (updatedPokemon.count !== 1) {
          throw new PokemonCenterHealingPersistenceConflictError(
            'POKEMON_STATE_CHANGED',
            [
              `Pokémon "${expectedPokemon.instanceId}" changed`,
              `before healing could be persisted for trainer "${trainerId}"`,
            ].join(' '),
          );
        }

        for (let slot = 0; slot < expectedPokemon.moves.length; slot += 1) {
          const expectedMove = expectedPokemon.moves[slot];
          const healedMove = healedPokemon.moves[slot];

          if (!expectedMove || !healedMove) {
            throw new Error(
              `Healing plan move layout changed for Pokémon "${expectedPokemon.instanceId}"`,
            );
          }

          const updatedMove = await tx.pokemonInstanceMove.updateMany({
            where: {
              pokemonInstanceId: expectedPokemon.instanceId,
              slot,
              moveId: expectedMove.moveId,
              currentPp: expectedMove.currentPp,
            },
            data: {
              currentPp: healedMove.currentPp,
            },
          });

          if (updatedMove.count !== 1) {
            throw new PokemonCenterHealingPersistenceConflictError(
              'MOVE_STATE_CHANGED',
              [
                `Move slot ${slot} of Pokémon "${expectedPokemon.instanceId}" changed`,
                `before healing could be persisted for trainer "${trainerId}"`,
              ].join(' '),
            );
          }
        }
      }
    });
  }
}

function assertHealingPartyShape(
  expectedParty: PokemonParty,
  healedParty: PokemonParty,
): void {
  const expectedIds = expectedParty.pokemon.map(
    (pokemon) => pokemon.instanceId,
  );

  const healedIds = healedParty.pokemon.map((pokemon) => pokemon.instanceId);

  if (
    new Set(expectedIds).size !== expectedIds.length ||
    new Set(healedIds).size !== healedIds.length
  ) {
    throw new Error(
      'Pokémon Center healing Party contains duplicate instance ids',
    );
  }

  if (expectedIds.length !== healedIds.length) {
    throw new Error('Pokémon Center healing changed the Party size');
  }

  const healedByInstanceId = new Map(
    healedParty.pokemon.map((pokemon) => [pokemon.instanceId, pokemon]),
  );

  for (const expectedPokemon of expectedParty.pokemon) {
    const healedPokemon = healedByInstanceId.get(expectedPokemon.instanceId);

    if (!healedPokemon) {
      throw new Error(
        [
          'Pokémon Center healing changed Party membership for',
          `Pokémon "${expectedPokemon.instanceId}"`,
        ].join(' '),
      );
    }

    if (expectedPokemon.moves.length !== healedPokemon.moves.length) {
      throw new Error(
        `Pokémon Center healing changed move count for Pokémon "${expectedPokemon.instanceId}"`,
      );
    }

    for (let slot = 0; slot < expectedPokemon.moves.length; slot += 1) {
      const expectedMove = expectedPokemon.moves[slot];
      const healedMove = healedPokemon.moves[slot];

      if (
        !expectedMove ||
        !healedMove ||
        expectedMove.moveId !== healedMove.moveId
      ) {
        throw new Error(
          [
            `Pokémon Center healing changed move slot ${slot} for`,
            `Pokémon "${expectedPokemon.instanceId}"`,
          ].join(' '),
        );
      }
    }
  }
}

function assertPersistedPartyMatchesExpected(
  trainerId: PokemonTrainerId,
  expectedParty: PokemonParty,
  persistedParty: readonly PersistedPartyPokemon[],
): void {
  if (persistedParty.length !== expectedParty.pokemon.length) {
    throw new PokemonCenterHealingPersistenceConflictError(
      'PARTY_STATE_CHANGED',
      `Active Party changed before healing could be persisted for trainer "${trainerId}"`,
    );
  }

  const persistedByInstanceId = new Map(
    persistedParty.map((pokemon) => [pokemon.id, pokemon]),
  );

  for (const expectedPokemon of expectedParty.pokemon) {
    const persistedPokemon = persistedByInstanceId.get(
      expectedPokemon.instanceId,
    );

    if (!persistedPokemon) {
      throw new PokemonCenterHealingPersistenceConflictError(
        'PARTY_STATE_CHANGED',
        [
          `Pokémon "${expectedPokemon.instanceId}" is no longer in`,
          `the active Party of trainer "${trainerId}"`,
        ].join(' '),
      );
    }

    if (
      persistedPokemon.speciesId !== expectedPokemon.speciesId ||
      persistedPokemon.formId !== expectedPokemon.formId ||
      persistedPokemon.level !== expectedPokemon.level ||
      persistedPokemon.currentHp !== expectedPokemon.currentHp
    ) {
      throw new PokemonCenterHealingPersistenceConflictError(
        'POKEMON_STATE_CHANGED',
        `Pokémon "${expectedPokemon.instanceId}" changed before healing persistence`,
      );
    }

    if (persistedPokemon.moves.length !== expectedPokemon.moves.length) {
      throw new PokemonCenterHealingPersistenceConflictError(
        'MOVE_STATE_CHANGED',
        `Move layout changed for Pokémon "${expectedPokemon.instanceId}"`,
      );
    }

    for (let slot = 0; slot < expectedPokemon.moves.length; slot += 1) {
      const expectedMove = expectedPokemon.moves[slot];
      const persistedMove = persistedPokemon.moves[slot];

      if (
        !expectedMove ||
        !persistedMove ||
        persistedMove.slot !== slot ||
        persistedMove.moveId !== expectedMove.moveId ||
        persistedMove.currentPp !== expectedMove.currentPp
      ) {
        throw new PokemonCenterHealingPersistenceConflictError(
          'MOVE_STATE_CHANGED',
          `Move slot ${slot} changed for Pokémon "${expectedPokemon.instanceId}"`,
        );
      }
    }
  }
}
