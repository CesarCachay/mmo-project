import { createPokemonInstance } from '@cesar-mmo/shared';

import { PrismaService } from '../database/prisma.service.js';

const BULBASAUR_SPECIES_ID = 1;
const BULBASAUR_LEVEL = 7;

const POTION_ITEM_ID = 'potion';
const POKE_BALL_ITEM_ID = 'poke-ball';
const DEFAULT_ITEM_QUANTITY = 5;

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
      'Pass the trainerId explicitly: node .../reset-trainer-pokemon.js <trainerId>',
    );
  }

  const trainer = trainers[0];

  if (!trainer) {
    throw new Error('Unable to resolve the Pokémon trainer.');
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
      throw new Error(`Pokémon trainer "${trainerId}" does not exist.`);
    }

    /*
     * Use the shared domain factory instead of hand-writing stats.
     *
     * It resolves:
     * - default form
     * - initial HP
     * - ability
     * - legal level-up moves
     * - PP
     * - instance UUID
     */
    const bulbasaur = createPokemonInstance(
      BULBASAUR_SPECIES_ID,
      BULBASAUR_LEVEL,
    );

    const deletedPokemonCount = await prisma.$transaction(async (tx) => {
      /*
       * This is an intentional FULL RESET for this Trainer.
       *
       * Unlike PokemonPartyRepository.saveParty(), which only removes Pokémon
       * from the active party by setting partyPosition = null, this deletes
       * every owned PokemonInstance for the Trainer.
       *
       * PokemonInstanceMove rows are removed by the DB cascade.
       */
      const deleted = await tx.pokemonInstance.deleteMany({
        where: {
          trainerId,
        },
      });

      await tx.pokemonInstance.create({
        data: {
          id: bulbasaur.instanceId,
          trainerId,
          speciesId: bulbasaur.speciesId,
          formId: bulbasaur.formId,
          nickname: bulbasaur.nickname ?? null,
          level: bulbasaur.level,
          experience: bulbasaur.experience,
          currentHp: bulbasaur.currentHp,
          abilityId: bulbasaur.abilityId,
          partyPosition: 0,
        },
      });

      if (bulbasaur.moves.length > 0) {
        await tx.pokemonInstanceMove.createMany({
          data: bulbasaur.moves.map((move, slot) => ({
            pokemonInstanceId: bulbasaur.instanceId,
            slot,
            moveId: move.moveId,
            currentPp: move.currentPp,
          })),
        });
      }

      /*
       * Ensure the Trainer ALWAYS finishes this reset with exactly:
       * - 5 Potions
       * - 5 Poké Balls
       *
       * Only these two stacks are replaced. Any other inventory items
       * the Trainer may own are preserved.
       */
      await tx.pokemonTrainerInventoryItem.deleteMany({
        where: {
          trainerId,
          itemId: {
            in: [POTION_ITEM_ID, POKE_BALL_ITEM_ID],
          },
        },
      });

      await tx.pokemonTrainerInventoryItem.createMany({
        data: [
          {
            trainerId,
            itemId: POTION_ITEM_ID,
            quantity: DEFAULT_ITEM_QUANTITY,
          },
          {
            trainerId,
            itemId: POKE_BALL_ITEM_ID,
            quantity: DEFAULT_ITEM_QUANTITY,
          },
        ],
      });

      return deleted.count;
    });

    const totalPokemonCount = await prisma.pokemonInstance.count({
      where: {
        trainerId,
      },
    });

    const inventoryItems = await prisma.pokemonTrainerInventoryItem.findMany({
      where: {
        trainerId,
        itemId: {
          in: [POTION_ITEM_ID, POKE_BALL_ITEM_ID],
        },
      },
      select: {
        itemId: true,
        quantity: true,
      },
    });

    const inventoryQuantityById = new Map(
      inventoryItems.map((item) => [item.itemId, item.quantity]),
    );

    const potionQuantity = inventoryQuantityById.get(POTION_ITEM_ID) ?? 0;
    const pokeBallQuantity = inventoryQuantityById.get(POKE_BALL_ITEM_ID) ?? 0;
    const totalResetItemQuantity = potionQuantity + pokeBallQuantity;

    console.log('');
    console.log('============================================');
    console.log('Pokémon Trainer Reset Complete');
    console.log('============================================');
    console.log(`Trainer:           ${trainerId}`);
    console.log(`Deleted Pokémon:   ${deletedPokemonCount}`);
    console.log(`Total Pokémon:     ${totalPokemonCount}`);
    console.log(`Starter:           Bulbasaur (#001)`);
    console.log(`Level:             ${bulbasaur.level}`);
    console.log(`Party position:    0`);
    console.log(`Instance ID:       ${bulbasaur.instanceId}`);
    console.log(`Current HP:        ${bulbasaur.currentHp}`);
    console.log(`Ability ID:        ${bulbasaur.abilityId}`);
    console.log(
      `Moves:             ${
        bulbasaur.moves.length > 0
          ? bulbasaur.moves
              .map(
                (move, slot) =>
                  `[${slot}] moveId=${move.moveId}, pp=${move.currentPp}`,
              )
              .join(' | ')
          : '(none)'
      }`,
    );
    console.log('--------------------------------------------');
    console.log('Inventory reset:');
    console.log(`Potion:            x${potionQuantity}`);
    console.log(`Poké Ball:         x${pokeBallQuantity}`);
    console.log(`Total item units:  ${totalResetItemQuantity}`);
    console.log('============================================');
    console.log('');
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error('');
  console.error('❌ Failed to reset Trainer Pokémon and inventory');
  console.error(error);
  process.exitCode = 1;
});
