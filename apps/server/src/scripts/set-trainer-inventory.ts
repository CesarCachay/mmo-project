import { isPokemonItemId, type PokemonItemId } from '@cesar-mmo/shared';

import { PrismaService } from '../database/prisma.service.js';

const DESIRED_ITEMS = [
  {
    itemId: 'poke-ball',
    quantity: 10,
  },
  // {
  //   itemId: 'great-ball', // Super Ball
  //   quantity: 10,
  // },
  // {
  //   itemId: 'master-ball',
  //   quantity: 2,
  // },
  {
    itemId: 'potion',
    quantity: 10,
  },
] as const;

interface ValidatedInventoryItem {
  itemId: PokemonItemId;
  quantity: number;
}

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
    console.error('');
    console.error('More than one Trainer exists:');

    for (const trainer of trainers) {
      console.error(`  - ${trainer.id}`);
    }

    console.error('');

    throw new Error(
      'Pass the trainerId explicitly: node .../set-trainer-inventory.js <trainerId>',
    );
  }

  const trainer = trainers[0];

  if (!trainer) {
    throw new Error('Unable to resolve the Pokémon Trainer.');
  }

  return trainer.id;
}

function validateDesiredItems(): ValidatedInventoryItem[] {
  const validatedItems: ValidatedInventoryItem[] = [];

  for (const item of DESIRED_ITEMS) {
    const specificItem = item.itemId;
    /* Important: Never persist an Item ID that Shared does not know */
    if (!isPokemonItemId(item.itemId)) {
      throw new Error(
        [
          `Pokémon item ${specificItem} is not registered in @cesar-mmo/shared.`,
          '',
          'Add it to PokemonItemId / POKEMON_ITEM_REGISTRY before running this script.',
          '',
          'No database changes were made.',
        ].join('\n'),
      );
    }

    validatedItems.push({
      itemId: item.itemId,
      quantity: item.quantity,
    });
  }

  return validatedItems;
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

    /*
     * Validate EVERYTHING before touching PostgreSQL.
     */
    const items = validateDesiredItems();

    const itemIds = items.map((item) => item.itemId);

    await prisma.$transaction(async (tx) => {
      /*
       * We only replace the requested item stacks.
       *
       * Other inventory items owned by the Trainer
       * are preserved.
       */
      await tx.pokemonTrainerInventoryItem.deleteMany({
        where: {
          trainerId,
          itemId: {
            in: itemIds,
          },
        },
      });

      await tx.pokemonTrainerInventoryItem.createMany({
        data: items.map((item) => ({
          trainerId,
          itemId: item.itemId,
          quantity: item.quantity,
        })),
      });
    });

    const updatedItems = await prisma.pokemonTrainerInventoryItem.findMany({
      where: {
        trainerId,
        itemId: {
          in: itemIds,
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

    console.log('');
    console.log('============================================');
    console.log('Pokémon Trainer Inventory Updated');
    console.log('============================================');
    console.log(`Trainer: ${trainerId}`);
    console.log('--------------------------------------------');

    for (const item of updatedItems) {
      console.log(`${item.itemId.padEnd(20, ' ')} x${item.quantity}`);
    }

    console.log('============================================');
    console.log('');
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error('');
  console.error('❌ Failed to update Trainer inventory');
  console.error(error);
  console.error('');
  process.exitCode = 1;
});
