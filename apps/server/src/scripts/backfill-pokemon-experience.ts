import {
  getExperienceForLevel,
  getPokemonSpecies,
  isPokemonExperienceCompatibleWithLevel,
  MAX_POKEMON_LEVEL,
  MIN_POKEMON_LEVEL,
} from '@cesar-mmo/shared';

import { PrismaService } from '../database/prisma.service.js';

interface PokemonExperienceRepair {
  readonly pokemonInstanceId: string;
  readonly trainerId: string;
  readonly speciesId: number;
  readonly level: number;
  readonly previousExperience: number;
  readonly normalizedExperience: number;
  readonly growthRate: string;
}

function isApplyMode(): boolean {
  return process.argv.includes('--apply');
}

async function main(): Promise<void> {
  const prisma = new PrismaService();

  await prisma.$connect();

  try {
    const applyChanges = isApplyMode();

    console.log('');
    console.log('============================================');
    console.log('Pokémon EXP Compatibility Backfill');
    console.log('============================================');
    console.log(`Mode: ${applyChanges ? 'APPLY' : 'DRY RUN'}`);
    console.log('');

    /*
     * Scan ALL owned Pokémon.
     *
     * This intentionally includes:
     * - active Party
     * - Storage Pokémon
     *
     * Otherwise a legacy Pokémon could become invalid again
     * after being withdrawn from Storage later.
     */
    const pokemonInstances = await prisma.pokemonInstance.findMany({
      select: {
        id: true,
        trainerId: true,
        speciesId: true,
        level: true,
        experience: true,
        partyPosition: true,
      },

      orderBy: [
        {
          trainerId: 'asc',
        },
        {
          createdAt: 'asc',
        },
      ],
    });

    const repairs: PokemonExperienceRepair[] = [];

    for (const pokemon of pokemonInstances) {
      /*
       * Do NOT silently repair invalid levels.
       *
       * That would represent a different data-corruption problem
       * and deserves explicit investigation.
       */
      if (
        !Number.isInteger(pokemon.level) ||
        pokemon.level < MIN_POKEMON_LEVEL ||
        pokemon.level > MAX_POKEMON_LEVEL
      ) {
        throw new Error(
          [
            `Pokémon "${pokemon.id}"`,
            `has invalid level "${pokemon.level}".`,
            'Backfill aborted before modifying PostgreSQL.',
          ].join(' '),
        );
      }

      const species = getPokemonSpecies(pokemon.speciesId);

      if (!species) {
        throw new Error(
          [
            `Pokémon "${pokemon.id}"`,
            `references unknown species "${pokemon.speciesId}".`,
            'Backfill aborted before modifying PostgreSQL.',
          ].join(' '),
        );
      }

      const compatible = isPokemonExperienceCompatibleWithLevel(
        species.growthRate,
        pokemon.level,
        pokemon.experience,
      );

      if (compatible) {
        continue;
      }

      /*
       * Legacy policy:
       *
       * Keep persisted level authoritative and normalize EXP
       * to exactly the lower threshold of that level.
       */
      const normalizedExperience = getExperienceForLevel(
        species.growthRate,
        pokemon.level,
      );

      repairs.push({
        pokemonInstanceId: pokemon.id,
        trainerId: pokemon.trainerId,
        speciesId: pokemon.speciesId,
        level: pokemon.level,
        previousExperience: pokemon.experience,
        normalizedExperience,
        growthRate: species.growthRate,
      });
    }

    console.log(`Pokémon scanned: ${pokemonInstances.length}`);

    console.log(`Repairs required: ${repairs.length}`);

    if (repairs.length === 0) {
      console.log('');
      console.log('✅ All persisted Pokémon already have compatible EXP.');
      console.log('');

      return;
    }

    console.log('');
    console.log('Repairs:');

    for (const repair of repairs) {
      console.log(
        [
          `- ${repair.pokemonInstanceId}`,
          `species=${repair.speciesId}`,
          `Lv.${repair.level}`,
          `growth=${repair.growthRate}`,
          `EXP ${repair.previousExperience}`,
          `→ ${repair.normalizedExperience}`,
        ].join(' | '),
      );
    }

    /*
     * Default behavior is DRY RUN.
     *
     * Mutation only occurs with:
     *
     * --apply
     */
    if (!applyChanges) {
      console.log('');
      console.log('ℹ️ Dry run only. PostgreSQL was NOT modified.');

      console.log('Run again with --apply to persist these repairs.');

      console.log('');

      return;
    }

    /*
     * PostgreSQL update is atomic.
     *
     * Also use the previous level/experience as optimistic
     * predicates so we do not overwrite a Pokémon that changed
     * between scan and update.
     */
    await prisma.$transaction(async (tx) => {
      for (const repair of repairs) {
        const result = await tx.pokemonInstance.updateMany({
          where: {
            id: repair.pokemonInstanceId,

            trainerId: repair.trainerId,

            level: repair.level,

            experience: repair.previousExperience,
          },

          data: {
            experience: repair.normalizedExperience,
          },
        });

        if (result.count !== 1) {
          throw new Error(
            [
              'Pokémon changed while running EXP backfill:',
              `"${repair.pokemonInstanceId}".`,
              'Transaction rolled back.',
            ].join(' '),
          );
        }
      }
    });

    console.log('');
    console.log('============================================');
    console.log('Backfill complete');
    console.log('============================================');
    console.log(`Updated Pokémon: ${repairs.length}`);
    console.log('✅ level preserved');
    console.log('✅ HP preserved');
    console.log('✅ moves preserved');
    console.log('✅ Party / Storage preserved');
    console.log('✅ ownership preserved');
    console.log('============================================');
    console.log('');
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error('');
  console.error('❌ Failed to normalize Pokémon experience');
  console.error(error);

  process.exitCode = 1;
});
