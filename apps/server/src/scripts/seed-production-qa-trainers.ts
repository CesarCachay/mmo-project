import { createHash } from 'node:crypto';

import { createPokemonInstance, type PokemonItemId } from '@cesar-mmo/shared';

import { PrismaService } from '../database/prisma.service.js';

type QaProfile = 'items' | 'pokemon' | 'full';

interface QaPokemonDefinition {
  readonly key: string;
  readonly speciesId: number;
  readonly level: number;
  readonly label: string;
}

interface CliOptions {
  readonly trainerIds: readonly string[];
  readonly profile: QaProfile;
  readonly apply: boolean;
  readonly confirmProduction: boolean;
  readonly listTrainers: boolean;
}

const MAX_PARTY_SIZE = 6;

const QA_POKEMON = [
  { key: 'charmander-lv15', speciesId: 4, level: 15, label: 'Charmander Lv15' },
  { key: 'squirtle-lv15', speciesId: 7, level: 15, label: 'Squirtle Lv15' },
  { key: 'bulbasaur-lv15', speciesId: 1, level: 15, label: 'Bulbasaur Lv15' },
  { key: 'dratini-lv20', speciesId: 147, level: 20, label: 'Dratini Lv20' },
  { key: 'larvitar-lv15', speciesId: 246, level: 15, label: 'Larvitar Lv15' },
] as const satisfies readonly QaPokemonDefinition[];

const QA_ITEM_MINIMUMS = [
  ['potion', 20],
  ['super-potion', 20],
  ['hyper-potion', 20],
  ['max-potion', 20],
  ['revive', 20],
  ['max-revive', 20],
  ['poke-ball', 50],
] as const satisfies readonly (readonly [PokemonItemId, number])[];

function printUsage(): void {
  console.log(`
Usage:
  node .../seed-production-qa-trainers.js --list-trainers

  node .../seed-production-qa-trainers.js \\
    --trainer <trainerId> \\
    [--trainer <trainerId> ...] \\
    [--profile items|pokemon|full] \\
    [--apply] \\
    [--confirm-production]

Defaults:
  --profile full
  Without --apply the script performs a DRY RUN.

Production safety:
  NODE_ENV=production + --apply requires --confirm-production.
`);
}

function parseCliOptions(argv: readonly string[]): CliOptions {
  const trainerIds: string[] = [];
  let profile: QaProfile = 'full';
  let apply = false;
  let confirmProduction = false;
  let listTrainers = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case '--trainer': {
        const trainerId = argv[index + 1]?.trim();
        if (!trainerId) throw new Error('--trainer requires a trainerId.');
        trainerIds.push(trainerId);
        index += 1;
        break;
      }
      case '--profile': {
        const rawProfile = argv[index + 1]?.trim();
        if (
          rawProfile !== 'items' &&
          rawProfile !== 'pokemon' &&
          rawProfile !== 'full'
        ) {
          throw new Error(
            `--profile must be "items", "pokemon", or "full". Received "${rawProfile ?? ''}".`,
          );
        }
        profile = rawProfile;
        index += 1;
        break;
      }
      case '--apply':
        apply = true;
        break;
      case '--confirm-production':
        confirmProduction = true;
        break;
      case '--list-trainers':
        listTrainers = true;
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument "${arg}". Use --help.`);
    }
  }

  return {
    trainerIds: [...new Set(trainerIds)],
    profile,
    apply,
    confirmProduction,
    listTrainers,
  };
}

function assertSafeMutation(options: CliOptions): void {
  if (!options.apply) return;
  if (process.env.NODE_ENV === 'production' && !options.confirmProduction) {
    throw new Error('Production mutation requires --confirm-production.');
  }
}

function shouldSeedItems(profile: QaProfile): boolean {
  return profile === 'items' || profile === 'full';
}

function shouldSeedPokemon(profile: QaProfile): boolean {
  return profile === 'pokemon' || profile === 'full';
}

function createQaPokemonInstanceId(
  trainerId: string,
  pokemonKey: string,
): string {
  const digest = createHash('sha256')
    .update(`cesar-mmo:production-qa:v1:${trainerId}:${pokemonKey}`)
    .digest('hex')
    .slice(0, 32)
    .split('');

  digest[12] = '5';
  digest[16] = ((Number.parseInt(digest[16] ?? '0', 16) & 0x3) | 0x8).toString(
    16,
  );

  const hex = digest.join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

async function listTrainers(prisma: PrismaService): Promise<void> {
  const trainers = await prisma.pokemonTrainer.findMany({
    select: { id: true, displayName: true, accountId: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log('\n======================================================');
  console.log('Cesar MMO — Trainers');
  console.log('======================================================');

  if (trainers.length === 0) console.log('(no trainers)');

  for (const trainer of trainers) {
    console.log(
      `${trainer.displayName.padEnd(16)}  ${trainer.id}  account=${trainer.accountId}`,
    );
  }

  console.log('======================================================\n');
}

async function assertTrainerExists(
  prisma: PrismaService,
  trainerId: string,
): Promise<{ id: string; displayName: string }> {
  const trainer = await prisma.pokemonTrainer.findUnique({
    where: { id: trainerId },
    select: { id: true, displayName: true },
  });

  if (!trainer)
    throw new Error(`Pokémon Trainer "${trainerId}" does not exist.`);
  return trainer;
}

async function printTrainerDryRun(
  prisma: PrismaService,
  trainerId: string,
  profile: QaProfile,
): Promise<void> {
  const trainer = await assertTrainerExists(prisma, trainerId);

  console.log('\n------------------------------------------------------');
  console.log(`Trainer: ${trainer.displayName} (${trainer.id})`);
  console.log('Mode:    DRY RUN');
  console.log(`Profile: ${profile}`);
  console.log('------------------------------------------------------');

  if (shouldSeedItems(profile)) {
    const currentItems = await prisma.pokemonTrainerInventoryItem.findMany({
      where: {
        trainerId,
        itemId: { in: QA_ITEM_MINIMUMS.map(([itemId]) => itemId) },
      },
      select: { itemId: true, quantity: true },
    });

    const currentQuantityByItemId = new Map(
      currentItems.map((item) => [item.itemId, item.quantity]),
    );

    console.log('Items:');
    for (const [itemId, minimumQuantity] of QA_ITEM_MINIMUMS) {
      const currentQuantity = currentQuantityByItemId.get(itemId) ?? 0;
      const targetQuantity = Math.max(currentQuantity, minimumQuantity);
      console.log(
        `  ${itemId.padEnd(16)} ${String(currentQuantity).padStart(3)} -> ${String(targetQuantity).padStart(3)}`,
      );
    }
  }

  if (shouldSeedPokemon(profile)) {
    const partyRows = await prisma.pokemonInstance.findMany({
      where: { trainerId, partyPosition: { not: null } },
      select: { id: true, partyPosition: true },
    });

    const occupiedPartyPositions = new Set(
      partyRows
        .map((pokemon) => pokemon.partyPosition)
        .filter((position): position is number => position !== null),
    );

    const freePartyPositions: number[] = [];
    for (let position = 0; position < MAX_PARTY_SIZE; position += 1) {
      if (!occupiedPartyPositions.has(position))
        freePartyPositions.push(position);
    }

    console.log('Pokémon:');
    for (const definition of QA_POKEMON) {
      const instanceId = createQaPokemonInstanceId(trainerId, definition.key);
      const existing = await prisma.pokemonInstance.findUnique({
        where: { id: instanceId },
        select: {
          id: true,
          trainerId: true,
          speciesId: true,
          level: true,
          partyPosition: true,
        },
      });

      if (existing) {
        if (existing.trainerId !== trainerId) {
          throw new Error(
            `QA Pokémon id collision "${instanceId}" belongs to another Trainer.`,
          );
        }
        console.log(
          `  EXISTING  ${definition.label.padEnd(18)} id=${instanceId} partyPosition=${existing.partyPosition ?? 'storage'} currentSpecies=${existing.speciesId} currentLevel=${existing.level}`,
        );
        continue;
      }

      const partyPosition = freePartyPositions.shift() ?? null;
      console.log(
        `  CREATE    ${definition.label.padEnd(18)} id=${instanceId} -> ${partyPosition === null ? 'Storage' : `Party slot ${partyPosition}`}`,
      );
    }
  }

  console.log('No database changes performed.');
}

async function applyTrainerSeed(
  prisma: PrismaService,
  trainerId: string,
  profile: QaProfile,
): Promise<{
  readonly displayName: string;
  readonly itemsChanged: number;
  readonly pokemonCreated: number;
  readonly pokemonExisting: number;
}> {
  const trainer = await assertTrainerExists(prisma, trainerId);

  return prisma.$transaction(async (tx) => {
    let itemsChanged = 0;
    let pokemonCreated = 0;
    let pokemonExisting = 0;

    if (shouldSeedItems(profile)) {
      for (const [itemId, minimumQuantity] of QA_ITEM_MINIMUMS) {
        const current = await tx.pokemonTrainerInventoryItem.findUnique({
          where: { trainerId_itemId: { trainerId, itemId } },
          select: { quantity: true },
        });

        const targetQuantity = Math.max(
          current?.quantity ?? 0,
          minimumQuantity,
        );
        if (current?.quantity === targetQuantity) continue;

        await tx.pokemonTrainerInventoryItem.upsert({
          where: { trainerId_itemId: { trainerId, itemId } },
          create: { trainerId, itemId, quantity: targetQuantity },
          update: { quantity: targetQuantity },
        });
        itemsChanged += 1;
      }
    }

    if (shouldSeedPokemon(profile)) {
      const partyRows = await tx.pokemonInstance.findMany({
        where: { trainerId, partyPosition: { not: null } },
        select: { partyPosition: true },
      });

      const occupiedPartyPositions = new Set(
        partyRows
          .map((pokemon) => pokemon.partyPosition)
          .filter((position): position is number => position !== null),
      );

      const freePartyPositions: number[] = [];
      for (let position = 0; position < MAX_PARTY_SIZE; position += 1) {
        if (!occupiedPartyPositions.has(position))
          freePartyPositions.push(position);
      }

      for (const definition of QA_POKEMON) {
        const instanceId = createQaPokemonInstanceId(trainerId, definition.key);
        const existing = await tx.pokemonInstance.findUnique({
          where: { id: instanceId },
          select: { trainerId: true },
        });

        if (existing) {
          if (existing.trainerId !== trainerId) {
            throw new Error(
              `QA Pokémon id collision "${instanceId}" belongs to another Trainer.`,
            );
          }
          pokemonExisting += 1;
          continue;
        }

        const pokemon = createPokemonInstance(
          definition.speciesId,
          definition.level,
        );
        const partyPosition = freePartyPositions.shift() ?? null;

        await tx.pokemonInstance.create({
          data: {
            id: instanceId,
            trainerId,
            speciesId: pokemon.speciesId,
            formId: pokemon.formId,
            nickname: pokemon.nickname ?? null,
            level: pokemon.level,
            experience: pokemon.experience,
            currentHp: pokemon.currentHp,
            abilityId: pokemon.abilityId,
            partyPosition,
          },
        });

        if (pokemon.moves.length > 0) {
          await tx.pokemonInstanceMove.createMany({
            data: pokemon.moves.map((move, slot) => ({
              pokemonInstanceId: instanceId,
              slot,
              moveId: move.moveId,
              currentPp: move.currentPp,
            })),
          });
        }

        pokemonCreated += 1;
      }
    }

    return {
      displayName: trainer.displayName,
      itemsChanged,
      pokemonCreated,
      pokemonExisting,
    };
  });
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  assertSafeMutation(options);

  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    if (options.listTrainers) {
      await listTrainers(prisma);
      return;
    }

    if (options.trainerIds.length === 0) {
      printUsage();
      throw new Error(
        'Pass at least one --trainer <trainerId>, or use --list-trainers.',
      );
    }

    console.log('\n======================================================');
    console.log('Cesar MMO — Production QA Seed');
    console.log('======================================================');
    console.log(`NODE_ENV: ${process.env.NODE_ENV ?? '(unset)'}`);
    console.log(`Profile:  ${options.profile}`);
    console.log(`Mode:     ${options.apply ? 'APPLY' : 'DRY RUN'}`);
    console.log(`Trainers: ${options.trainerIds.length}`);
    console.log('======================================================');

    if (!options.apply) {
      for (const trainerId of options.trainerIds) {
        await printTrainerDryRun(prisma, trainerId, options.profile);
      }
      console.log('\nDRY RUN COMPLETE — no data was modified.\n');
      return;
    }

    let failures = 0;

    for (const trainerId of options.trainerIds) {
      try {
        const result = await applyTrainerSeed(
          prisma,
          trainerId,
          options.profile,
        );
        console.log(`\n✅ ${result.displayName} (${trainerId})`);
        console.log(`   Item stacks changed: ${result.itemsChanged}`);
        console.log(`   QA Pokémon created:  ${result.pokemonCreated}`);
        console.log(`   QA Pokémon existing: ${result.pokemonExisting}`);
      } catch (error: unknown) {
        failures += 1;
        console.error(`\n❌ Trainer ${trainerId} failed`);
        console.error(error);
      }
    }

    console.log('\n======================================================');
    console.log('QA seed complete');
    console.log(`Processed: ${options.trainerIds.length}`);
    console.log(`Failures:  ${failures}`);
    console.log('======================================================\n');

    if (failures > 0) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error('\n❌ Production QA seed failed');
  console.error(error);
  process.exitCode = 1;
});
