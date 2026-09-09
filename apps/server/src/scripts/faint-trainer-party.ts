import { PrismaService } from '../database/prisma.service.js';

async function resolveTrainerId(prisma: PrismaService): Promise<string> {
  const cliTrainerId = process.argv[2]?.trim();

  if (cliTrainerId) {
    return cliTrainerId;
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
      'Pass trainerId explicitly: ' +
        'node dist/src/scripts/faint-trainer-party.js <trainerId>',
    );
  }

  const trainer = trainers[0];

  if (!trainer) {
    throw new Error('Unable to resolve Pokémon Trainer.');
  }

  return trainer.id;
}

async function main(): Promise<void> {
  const prisma = new PrismaService();

  await prisma.$connect();

  try {
    const trainerId = await resolveTrainerId(prisma);

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

    const party = await prisma.pokemonInstance.findMany({
      where: {
        trainerId,

        /*
         * Sólo Party.
         *
         * partyPosition = null
         * significa que está en Storage.
         */
        partyPosition: {
          not: null,
        },
      },

      select: {
        id: true,
        speciesId: true,
        nickname: true,
        currentHp: true,
        partyPosition: true,
      },

      orderBy: {
        partyPosition: 'asc',
      },
    });

    if (party.length === 0) {
      throw new Error(`Trainer "${trainerId}" has no Pokémon in Party.`);
    }

    console.log('');
    console.log('============================================');
    console.log('Pokémon Party — Before Faint');
    console.log('============================================');

    for (const pokemon of party) {
      console.log(
        [
          `slot=${pokemon.partyPosition}`,
          `species=${pokemon.speciesId}`,
          `id=${pokemon.id}`,
          `hp=${pokemon.currentHp}`,
          pokemon.nickname ? `nickname="${pokemon.nickname}"` : '',
        ]
          .filter(Boolean)
          .join(' | '),
      );
    }

    const result = await prisma.pokemonInstance.updateMany({
      where: {
        trainerId,
        partyPosition: {
          not: null,
        },
      },
      data: {
        currentHp: 0,
      },
    });

    console.log('');
    console.log('============================================');
    console.log('✅ ALL PARTY POKÉMON FAINTED');
    console.log('============================================');
    console.log(`Trainer:          ${trainerId}`);
    console.log(`Party Pokémon:    ${party.length}`);
    console.log(`Updated rows:     ${result.count}`);
    console.log('Current HP:       0');
    console.log('Storage affected: NO');
    console.log('============================================');
    console.log('');
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error('');
  console.error('❌ Failed to faint Trainer Party');
  console.error(error);

  process.exitCode = 1;
});
