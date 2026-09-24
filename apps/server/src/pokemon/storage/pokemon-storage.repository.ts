import { Injectable } from '@nestjs/common';

import {
  MAX_POKEMON_PARTY_SIZE,
  type PokemonInstance,
  type PokemonStorage,
} from '@cesar-mmo/shared';

import { PrismaService } from '../../database/prisma.service';

import type { PokemonTrainerId } from '../pokemon-trainer-identity';
import { fromPokemonMajorStatusPersistenceFields } from '../status/pokemon-major-status.persistence';

export type PokemonStoragePersistenceErrorCode =
  'PARTY_FULL' | 'LAST_PARTY_POKEMON' | 'INVALID_POKEMON' | 'STALE_COMMAND';

export class PokemonStoragePersistenceError extends Error {
  constructor(
    public readonly code: PokemonStoragePersistenceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PokemonStoragePersistenceError';
  }
}

interface PokemonStorageRow {
  readonly id: string;
  readonly speciesId: number;
  readonly formId: number;
  readonly nickname: string | null;
  readonly level: number;
  readonly experience: number;
  readonly currentHp: number;
  readonly abilityId: number;
  readonly majorStatus: string | null;
  readonly statusTurnsRemaining: number | null;

  readonly moves: readonly {
    readonly moveId: number;
    readonly currentPp: number;
  }[];
}

function mapPokemonInstance(row: PokemonStorageRow): PokemonInstance {
  return {
    instanceId: row.id,
    speciesId: row.speciesId,
    formId: row.formId,
    ...(row.nickname !== null
      ? {
          nickname: row.nickname,
        }
      : {}),
    level: row.level,
    experience: row.experience,
    currentHp: row.currentHp,
    abilityId: row.abilityId,
    majorStatus: fromPokemonMajorStatusPersistenceFields(
      row.majorStatus,
      row.statusTurnsRemaining,
    ),
    moves: row.moves.map((move) => ({
      moveId: move.moveId,
      currentPp: move.currentPp,
    })),
  };
}

@Injectable()
export class PokemonStorageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async loadStorage(trainerId: PokemonTrainerId): Promise<PokemonStorage> {
    const pokemon = await this.prisma.pokemonInstance.findMany({
      where: {
        trainerId,
        partyPosition: null,
      },
      orderBy: [
        {
          createdAt: 'asc',
        },
        {
          id: 'asc',
        },
      ],
      include: {
        moves: {
          orderBy: {
            slot: 'asc',
          },
        },
      },
    });

    return {
      pokemon: pokemon.map(mapPokemonInstance),
    };
  }

  async withdraw(
    trainerId: PokemonTrainerId,
    pokemonInstanceId: string,
  ): Promise<void> {
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
        throw new Error(`Pokémon trainer "${trainerId}" does not exist`);
      }

      /*
       * Primero resolvemos el Pokémon solicitado.
       * Esto es importante para distinguir correctamente:
       * - Pokémon ajeno/inexistente → INVALID_POKEMON
       * - Pokémon que ya salió de Storage → STALE_COMMAND
       * antes de evaluar si la Party está llena.
       */
      const storedPokemon = await tx.pokemonInstance.findFirst({
        where: {
          id: pokemonInstanceId,
          trainerId,
        },
        select: {
          id: true,
          partyPosition: true,
        },
      });

      if (!storedPokemon) {
        throw new PokemonStoragePersistenceError(
          'INVALID_POKEMON',
          `Pokémon "${pokemonInstanceId}" is not owned by trainer "${trainerId}"`,
        );
      }

      /*
       * Si ya posee partyPosition, entonces este comando fue
       * construido sobre un snapshot antiguo o es un double submit.
       */
      if (storedPokemon.partyPosition !== null) {
        throw new PokemonStoragePersistenceError(
          'STALE_COMMAND',
          `Pokémon "${pokemonInstanceId}" is no longer stored`,
        );
      }

      /*
       * Sólo después de confirmar que el target SIGUE realmente
       * en Storage comprobamos capacidad de Party.
       */
      const activeParty = await tx.pokemonInstance.findMany({
        where: {
          trainerId,
          partyPosition: {
            not: null,
          },
        },
        select: {
          id: true,
          partyPosition: true,
        },
        orderBy: {
          partyPosition: 'asc',
        },
      });

      if (activeParty.length >= MAX_POKEMON_PARTY_SIZE) {
        throw new PokemonStoragePersistenceError(
          'PARTY_FULL',
          `Trainer "${trainerId}" already has a full Pokémon Party`,
        );
      }

      const usedPositions = new Set<number>();

      for (const entry of activeParty) {
        if (entry.partyPosition === null) {
          continue;
        }

        if (
          !Number.isInteger(entry.partyPosition) ||
          entry.partyPosition < 0 ||
          entry.partyPosition >= MAX_POKEMON_PARTY_SIZE
        ) {
          throw new Error(
            `Invalid persisted Party position ${entry.partyPosition} for Pokémon "${entry.id}"`,
          );
        }

        usedPositions.add(entry.partyPosition);
      }

      let nextPartyPosition: number | undefined;

      for (let position = 0; position < MAX_POKEMON_PARTY_SIZE; position += 1) {
        if (!usedPositions.has(position)) {
          nextPartyPosition = position;
          break;
        }
      }

      if (nextPartyPosition === undefined) {
        throw new PokemonStoragePersistenceError(
          'PARTY_FULL',
          `No free Party position exists for trainer "${trainerId}"`,
        );
      }

      const update = await tx.pokemonInstance.updateMany({
        where: {
          id: pokemonInstanceId,
          trainerId,
          partyPosition: null,
        },
        data: {
          partyPosition: nextPartyPosition,
        },
      });

      if (update.count !== 1) {
        throw new PokemonStoragePersistenceError(
          'STALE_COMMAND',
          `Stored Pokémon "${pokemonInstanceId}" changed before withdraw could be committed`,
        );
      }
    });
  }

  async deposit(
    trainerId: PokemonTrainerId,
    pokemonInstanceId: string,
  ): Promise<void> {
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
        throw new Error(`Pokémon trainer "${trainerId}" does not exist`);
      }

      const activeParty = await tx.pokemonInstance.findMany({
        where: {
          trainerId,
          partyPosition: {
            not: null,
          },
        },
        select: {
          id: true,
          partyPosition: true,
        },
        orderBy: {
          partyPosition: 'asc',
        },
      });

      const target = activeParty.find(
        (entry) => entry.id === pokemonInstanceId,
      );

      if (!target) {
        const ownedPokemon = await tx.pokemonInstance.findFirst({
          where: {
            id: pokemonInstanceId,
            trainerId,
          },
          select: {
            id: true,
            partyPosition: true,
          },
        });

        if (!ownedPokemon) {
          throw new PokemonStoragePersistenceError(
            'INVALID_POKEMON',
            `Pokémon "${pokemonInstanceId}" is not owned by trainer "${trainerId}"`,
          );
        }

        throw new PokemonStoragePersistenceError(
          'STALE_COMMAND',
          `Pokémon "${pokemonInstanceId}" is no longer in the active Party`,
        );
      }

      /* V1: el Trainer nunca puede depositar su último Pokémon */
      if (activeParty.length <= 1) {
        throw new PokemonStoragePersistenceError(
          'LAST_PARTY_POKEMON',
          `Trainer "${trainerId}" cannot deposit the last Pokémon in the Party`,
        );
      }

      /*
       * Primero liberamos TODAS las Party positions dentro de
       * la misma transaction.
       * Esto evita conflictos con:
       * @@unique([trainerId, partyPosition])
       * y nos permite compactar 0..N-1 determinísticamente.
       */
      const clearedParty = await tx.pokemonInstance.updateMany({
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

      if (clearedParty.count !== activeParty.length) {
        throw new PokemonStoragePersistenceError(
          'STALE_COMMAND',
          `Trainer "${trainerId}" Party changed before deposit could be committed`,
        );
      }

      const remainingParty = activeParty.filter(
        (entry) => entry.id !== pokemonInstanceId,
      );

      for (
        let partyPosition = 0;
        partyPosition < remainingParty.length;
        partyPosition += 1
      ) {
        const pokemon = remainingParty[partyPosition];

        if (!pokemon) {
          continue;
        }

        const update = await tx.pokemonInstance.updateMany({
          where: {
            id: pokemon.id,
            trainerId,
            partyPosition: null,
          },
          data: {
            partyPosition,
          },
        });

        if (update.count !== 1) {
          throw new PokemonStoragePersistenceError(
            'STALE_COMMAND',
            `Pokémon "${pokemon.id}" changed while Party positions were being compacted`,
          );
        }
      }

      /* pokemonInstanceId permanece con partyPosition = null */
    });
  }

  async swap(
    trainerId: PokemonTrainerId,
    storedPokemonInstanceId: string,
    partyPokemonInstanceId: string,
  ): Promise<void> {
    if (storedPokemonInstanceId === partyPokemonInstanceId) {
      throw new PokemonStoragePersistenceError(
        'INVALID_POKEMON',
        'Storage swap requires two different Pokémon',
      );
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
        throw new Error(`Pokémon trainer "${trainerId}" does not exist`);
      }

      const pokemon = await tx.pokemonInstance.findMany({
        where: {
          trainerId,
          id: {
            in: [storedPokemonInstanceId, partyPokemonInstanceId],
          },
        },
        select: {
          id: true,
          partyPosition: true,
        },
      });

      if (pokemon.length !== 2) {
        throw new PokemonStoragePersistenceError(
          'INVALID_POKEMON',
          'One or more Pokémon selected for Storage swap are invalid',
        );
      }

      const storedPokemon = pokemon.find(
        (entry) => entry.id === storedPokemonInstanceId,
      );

      const partyPokemon = pokemon.find(
        (entry) => entry.id === partyPokemonInstanceId,
      );

      if (!storedPokemon || !partyPokemon) {
        throw new PokemonStoragePersistenceError(
          'INVALID_POKEMON',
          'Could not resolve both Pokémon selected for Storage swap',
        );
      }

      if (storedPokemon.partyPosition !== null) {
        throw new PokemonStoragePersistenceError(
          'STALE_COMMAND',
          `Pokémon "${storedPokemonInstanceId}" is no longer stored`,
        );
      }

      if (partyPokemon.partyPosition === null) {
        throw new PokemonStoragePersistenceError(
          'STALE_COMMAND',
          `Pokémon "${partyPokemonInstanceId}" is no longer in the active Party`,
        );
      }

      const partyPosition = partyPokemon.partyPosition;

      /*
       * Orden crítico:
       * 1. liberar posición
       * 2. asignar esa posición al stored Pokémon
       * porque existe:
       * @@unique([trainerId, partyPosition])
       */
      const depositUpdate = await tx.pokemonInstance.updateMany({
        where: {
          id: partyPokemonInstanceId,
          trainerId,
          partyPosition,
        },
        data: {
          partyPosition: null,
        },
      });

      if (depositUpdate.count !== 1) {
        throw new PokemonStoragePersistenceError(
          'STALE_COMMAND',
          `Party Pokémon "${partyPokemonInstanceId}" changed before swap could be committed`,
        );
      }

      const withdrawUpdate = await tx.pokemonInstance.updateMany({
        where: {
          id: storedPokemonInstanceId,
          trainerId,
          partyPosition: null,
        },
        data: {
          partyPosition,
        },
      });

      if (withdrawUpdate.count !== 1) {
        throw new PokemonStoragePersistenceError(
          'STALE_COMMAND',
          `Stored Pokémon "${storedPokemonInstanceId}" changed before swap could be committed`,
        );
      }
    });
  }
}
