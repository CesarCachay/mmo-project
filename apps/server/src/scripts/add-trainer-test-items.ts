import type { PokemonItemId } from '@cesar-mmo/shared';

import { PrismaService } from '../database/prisma.service.js';

const DEFAULT_QUANTITY = 10;

const TEST_ITEMS = [
  'potion',
  'poke-ball',
  'revive',
  'max-revive',
] as const satisfies readonly PokemonItemId[];

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
    throw new Error(
      'No Pokémon trainers exist in PostgreSQL. Connect to the game first so a trainer is created.',
    );
  }

  if (trainers.length > 1) {
    console.error('More than one trainer exists:');

    for (const trainer of trainers) {
      console.error(`  - ${trainer.id}`);
    }

    throw new Error(
      'Pass the trainerId explicitly: node apps/server/dist/src/scripts/add-trainer-test-items.js <trainerId> [quantity]',
    );
  }

  const trainer = trainers[0];

  if (!trainer) {
    throw new Error('Unable to resolve the Pokémon trainer.');
  }

  return trainer.id;
}

function resolveQuantity(): number {
  const rawQuantity = process.argv[3]?.trim();

  if (!rawQuantity) {
    return DEFAULT_QUANTITY;
  }

  const quantity = Number(rawQuantity);

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error(
      `Quantity must be a positive integer. Received "${rawQuantity}".`,
    );
  }

  return quantity;
}

async function main(): Promise<void> {
  const prisma = new PrismaService();

  await prisma.$connect();

  try {
    const trainerId = await resolveTrainerId(prisma);
    const quantity = resolveQuantity();

    const trainer = await prisma.pokemonTrainer.findUnique({
      where: {
        id: trainerId,
      },
      select: {
        id: true,
      },
    });

    if (!trainer) {
      throw new Error(`Pokémon trainer "${trainerId}" does not exist.`);
    }

    /*
     * ADDITIVE inventory mutation.
     *
     * Existing stack:
     *   quantity += requested quantity
     *
     * Missing stack:
     *   create quantity = requested quantity
     *
     * Other inventory items remain untouched.
     */
    await prisma.$transaction(
      TEST_ITEMS.map((itemId) =>
        prisma.pokemonTrainerInventoryItem.upsert({
          where: {
            trainerId_itemId: {
              trainerId,
              itemId,
            },
          },

          create: {
            trainerId,
            itemId,
            quantity,
          },

          update: {
            quantity: {
              increment: quantity,
            },
          },
        }),
      ),
    );

    const inventoryItems = await prisma.pokemonTrainerInventoryItem.findMany({
      where: {
        trainerId,
        itemId: {
          in: [...TEST_ITEMS],
        },
      },
      select: {
        itemId: true,
        quantity: true,
      },
      orderBy: {
        itemId: 'asc',
      },
    });

    const quantities = new Map(
      inventoryItems.map((item) => [item.itemId, item.quantity]),
    );

    console.log('');
    console.log('============================================');
    console.log('Pokémon Trainer Test Items Added');
    console.log('============================================');
    console.log(`Trainer:       ${trainerId}`);
    console.log(`Added each:    x${quantity}`);
    console.log('--------------------------------------------');
    console.log(`Potion:        x${quantities.get('potion') ?? 0}`);
    console.log(`Poké Ball:     x${quantities.get('poke-ball') ?? 0}`);
    console.log(`Revive:        x${quantities.get('revive') ?? 0}`);
    console.log(`Max Revive:    x${quantities.get('max-revive') ?? 0}`);
    console.log('============================================');
    console.log('');
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error('');
  console.error('❌ Failed to add Pokémon Trainer test items');
  console.error(error);
  process.exitCode = 1;
});
