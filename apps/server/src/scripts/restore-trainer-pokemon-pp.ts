import { getPokemonMove } from '@cesar-mmo/shared';

import { PrismaService } from '../database/prisma.service.js';

function getCliArguments(): {
  trainerId: string | undefined;
  includeStorage: boolean;
} {
  const args = process.argv.slice(2);

  return {
    trainerId: args.find((argument) => !argument.startsWith('--'))?.trim(),

    includeStorage: args.includes('--all'),
  };
}

async function resolveTrainerId(prisma: PrismaService): Promise<string> {
  const { trainerId } = getCliArguments();

  if (trainerId) {
    return trainerId;
  }

  const trainers = await prisma.pokemonTrainer.findMany({
    select: {
      id: true,
    },

    orderBy: {
      createdAt: 'asc',
    },
  });

  if (trainers.length === 0) {
    throw new Error('No Pokémon trainers exist in PostgreSQL.');
  }

  if (trainers.length > 1) {
    console.error('More than one Trainer exists:');

    for (const trainer of trainers) {
      console.error(`  - ${trainer.id}`);
    }

    throw new Error(
      [
        'Pass trainerId explicitly:',
        'node dist/src/scripts/',
        'restore-trainer-pokemon-pp.js',
        '<trainerId>',
      ].join(' '),
    );
  }

  const trainer = trainers[0];

  if (!trainer) {
    throw new Error('Unable to resolve Trainer.');
  }

  return trainer.id;
}

async function main(): Promise<void> {
  const prisma = new PrismaService();

  await prisma.$connect();

  try {
    const trainerId = await resolveTrainerId(prisma);

    const { includeStorage } = getCliArguments();

    const trainer = await prisma.pokemonTrainer.findUnique({
      where: {
        id: trainerId,
      },

      select: {
        id: true,
      },
    });

    if (!trainer) {
      throw new Error(`Pokémon Trainer "${trainerId}" does not exist.`);
    }

    const pokemon = await prisma.pokemonInstance.findMany({
      where: {
        trainerId,

        /*
         * Por defecto:
         * solamente Party activa.
         *
         * --all:
         * también Pokémon en Storage.
         */
        ...(includeStorage
          ? {}
          : {
              partyPosition: {
                not: null,
              },
            }),
      },

      select: {
        id: true,
        speciesId: true,
        nickname: true,
        partyPosition: true,

        moves: {
          select: {
            slot: true,
            moveId: true,
            currentPp: true,
          },

          orderBy: {
            slot: 'asc',
          },
        },
      },

      orderBy: [
        {
          partyPosition: 'asc',
        },
        {
          createdAt: 'asc',
        },
      ],
    });

    if (pokemon.length === 0) {
      throw new Error(
        includeStorage
          ? 'Trainer owns no Pokémon.'
          : 'Trainer has no Pokémon in Party.',
      );
    }

    console.log('');
    console.log('============================================');
    console.log('Pokémon PP Restoration — BEFORE');
    console.log('============================================');

    const updates: Array<{
      pokemonInstanceId: string;
      slot: number;
      moveId: number;
      previousPp: number;
      maxPp: number;
      moveName: string;
    }> = [];

    for (const instance of pokemon) {
      const pokemonName = instance.nickname ?? `Species #${instance.speciesId}`;

      console.log('');
      console.log(
        [
          pokemonName,
          `slot=${instance.partyPosition ?? 'STORAGE'}`,
          `id=${instance.id}`,
        ].join(' | '),
      );

      for (const move of instance.moves) {
        const definition = getPokemonMove(move.moveId);

        if (!definition) {
          throw new Error(`Move ${move.moveId} not found in registry.`);
        }

        /*
         * El proyecto actualmente trata
         * move.pp === null como 0.
         */
        const maxPp = definition.pp ?? 0;

        console.log(
          `  [${move.slot}] ${definition.name}: ` +
            `${move.currentPp}/${maxPp}`,
        );

        updates.push({
          pokemonInstanceId: instance.id,

          slot: move.slot,

          moveId: move.moveId,

          previousPp: move.currentPp,

          maxPp,

          moveName: definition.name,
        });
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const update of updates) {
        await tx.pokemonInstanceMove.updateMany({
          where: {
            pokemonInstanceId: update.pokemonInstanceId,

            slot: update.slot,
          },

          data: {
            currentPp: update.maxPp,
          },
        });
      }
    });

    const restoredMoves = updates.filter(
      (update) => update.previousPp !== update.maxPp,
    );

    console.log('');
    console.log('============================================');
    console.log('✅ POKÉMON PP RESTORED');
    console.log('============================================');

    console.log(`Trainer:          ${trainerId}`);

    console.log(
      `Scope:            ${includeStorage ? 'Party + Storage' : 'Party only'}`,
    );

    console.log(`Pokémon checked:  ${pokemon.length}`);

    console.log(`Moves checked:    ${updates.length}`);

    console.log(`Moves restored:   ${restoredMoves.length}`);

    if (restoredMoves.length > 0) {
      console.log('');

      for (const update of restoredMoves) {
        console.log(
          `  ${update.moveName}: ` + `${update.previousPp} → ${update.maxPp}`,
        );
      }
    }

    console.log('============================================');
    console.log('');
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error('');
  console.error('❌ Failed to restore Trainer Pokémon PP');
  console.error(error);

  process.exitCode = 1;
});
