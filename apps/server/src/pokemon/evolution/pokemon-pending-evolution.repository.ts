import { Injectable } from '@nestjs/common';

import type {
  PokemonEvolutionDecision,
  PokemonInstance,
} from '@cesar-mmo/shared';

import { PrismaService } from '../../database/prisma.service';

import type { PokemonTrainerId } from '../pokemon-trainer-identity';

import type { PokemonPendingEvolutionState } from './pokemon-pending-evolution.types';

export class PokemonPendingEvolutionPersistenceConflictError extends Error {
  constructor(message: string) {
    super(message);

    this.name = 'PokemonPendingEvolutionPersistenceConflictError';
  }
}

export interface ResolvePokemonPendingEvolutionPersistenceInput {
  readonly trainerId: PokemonTrainerId;
  readonly pokemonInstanceId: string;

  readonly expectedRevision: number;

  readonly expectedSpeciesId: number;
  readonly expectedFormId: number;
  readonly expectedAbilityId: number;
  readonly expectedCurrentHp: number;
  readonly expectedLevel: number;
  readonly expectedExperience: number;

  readonly decision: PokemonEvolutionDecision;

  readonly evolvedPokemon: PokemonInstance | null;
}

@Injectable()
export class PokemonPendingEvolutionRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async findByPokemonInstanceId(
    trainerId: PokemonTrainerId,
    pokemonInstanceId: string,
  ): Promise<PokemonPendingEvolutionState | undefined> {
    const record = await this.prisma.pokemonPendingEvolution.findUnique({
      where: {
        pokemonInstanceId,
      },
    });

    if (!record || record.trainerId !== trainerId) {
      return undefined;
    }

    return {
      trainerId: record.trainerId,
      pokemonInstanceId: record.pokemonInstanceId,
      sourceSpeciesId: record.sourceSpeciesId,
      sourceFormId: record.sourceFormId,
      targetSpeciesId: record.targetSpeciesId,
      targetFormId: record.targetFormId,
      triggerLevel: record.triggerLevel,
      revision: record.revision,
    };
  }

  public async findAllByTrainerId(
    trainerId: PokemonTrainerId,
  ): Promise<readonly PokemonPendingEvolutionState[]> {
    const records = await this.prisma.pokemonPendingEvolution.findMany({
      where: {
        trainerId,
      },

      /*
       * DB order is deterministic only as a fallback.
       *
       * The RecoveryService will ultimately restore
       * Party order from TrainerState.
       */
      orderBy: {
        pokemonInstanceId: 'asc',
      },
    });

    return records.map((record) => ({
      trainerId: record.trainerId,
      pokemonInstanceId: record.pokemonInstanceId,
      sourceSpeciesId: record.sourceSpeciesId,
      sourceFormId: record.sourceFormId,
      targetSpeciesId: record.targetSpeciesId,
      targetFormId: record.targetFormId,
      triggerLevel: record.triggerLevel,
      revision: record.revision,
    }));
  }

  public async resolveDecision(
    input: ResolvePokemonPendingEvolutionPersistenceInput,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const pending = await tx.pokemonPendingEvolution.findUnique({
        where: {
          pokemonInstanceId: input.pokemonInstanceId,
        },
      });

      if (
        !pending ||
        pending.trainerId !== input.trainerId ||
        pending.revision !== input.expectedRevision
      ) {
        throw new PokemonPendingEvolutionPersistenceConflictError(
          [
            'Pending evolution changed for',
            `Pokémon "${input.pokemonInstanceId}".`,
            `expectedRevision=${input.expectedRevision}`,
          ].join(' '),
        );
      }

      const currentPokemon = await tx.pokemonInstance.findFirst({
        where: {
          id: input.pokemonInstanceId,
          trainerId: input.trainerId,
          partyPosition: {
            not: null,
          },
          speciesId: input.expectedSpeciesId,
          formId: input.expectedFormId,
          abilityId: input.expectedAbilityId,
          currentHp: input.expectedCurrentHp,
          level: input.expectedLevel,
          experience: input.expectedExperience,
        },

        select: {
          id: true,
        },
      });

      if (!currentPokemon) {
        throw new PokemonPendingEvolutionPersistenceConflictError(
          [
            `Pokémon "${input.pokemonInstanceId}"`,
            'changed before its evolution decision',
            'could be persisted',
          ].join(' '),
        );
      }

      if (input.decision.type === 'accept') {
        if (!input.evolvedPokemon) {
          throw new Error('Accepted evolution requires evolvedPokemon');
        }

        const evolved = input.evolvedPokemon;

        const updated = await tx.pokemonInstance.updateMany({
          where: {
            id: input.pokemonInstanceId,
            trainerId: input.trainerId,
            speciesId: input.expectedSpeciesId,
            formId: input.expectedFormId,
            abilityId: input.expectedAbilityId,
            currentHp: input.expectedCurrentHp,
            level: input.expectedLevel,
            experience: input.expectedExperience,
          },

          data: {
            speciesId: evolved.speciesId,
            formId: evolved.formId,
            abilityId: evolved.abilityId,
            currentHp: evolved.currentHp,
          },
        });

        if (updated.count !== 1) {
          throw new PokemonPendingEvolutionPersistenceConflictError(
            [
              'Could not atomically evolve',
              `Pokémon "${input.pokemonInstanceId}"`,
            ].join(' '),
          );
        }
      }

      /* ACCEPT and CANCEL both finish THIS prompt */
      const deleted = await tx.pokemonPendingEvolution.deleteMany({
        where: {
          pokemonInstanceId: input.pokemonInstanceId,
          trainerId: input.trainerId,
          revision: input.expectedRevision,
        },
      });

      if (deleted.count !== 1) {
        throw new PokemonPendingEvolutionPersistenceConflictError(
          [
            'Pending evolution changed while resolving',
            `Pokémon "${input.pokemonInstanceId}"`,
          ].join(' '),
        );
      }
    });
  }
}
