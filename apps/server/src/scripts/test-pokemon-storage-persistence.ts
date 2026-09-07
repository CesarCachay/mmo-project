import { createPokemonInstance, type PokemonInstance } from '@cesar-mmo/shared';

import { PrismaService } from '../database/prisma.service.js';

import { PokemonPartyRepository } from '../pokemon/pokemon-party.repository.js';
import { PokemonTrainerStateStore } from '../pokemon/pokemon-trainer-state.store.js';

import {
  PokemonStoragePersistenceError,
  PokemonStorageRepository,
  type PokemonStoragePersistenceErrorCode,
} from '../pokemon/storage/pokemon-storage.repository.js';

import { PokemonStorageService } from '../pokemon/storage/pokemon-storage.service.js';

const PARTY_SPECIES = [
  1, // Bulbasaur
  4, // Charmander
  7, // Squirtle
  25, // Pikachu
  133, // Eevee
  246, // Larvitar
] as const;

const STORED_SPECIES_ID = 381; // Latios
const TEST_LEVEL = 10;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertPartyPositions(
  positions: Array<number | null>,
  expected: number[],
): void {
  const actual = positions
    .filter((position): position is number => position !== null)
    .sort((a, b) => a - b);

  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `Expected Party positions [${expected.join(', ')}], received [${actual.join(', ')}]`,
  );
}

async function expectStorageError(
  operation: () => Promise<unknown>,
  expectedCode: PokemonStoragePersistenceErrorCode,
): Promise<void> {
  try {
    await operation();
  } catch (error: unknown) {
    assert(
      error instanceof PokemonStoragePersistenceError,
      `Expected PokemonStoragePersistenceError for ${expectedCode}`,
    );

    assert(
      error.code === expectedCode,
      `Expected error code ${expectedCode}, received ${error.code}`,
    );

    console.log(`✅ rejected with ${expectedCode}`);

    return;
  }

  throw new Error(`Expected Storage operation to fail with ${expectedCode}`);
}

async function persistPokemon(
  prisma: PrismaService,
  trainerId: string,
  pokemon: PokemonInstance,
  partyPosition: number | null,
): Promise<void> {
  await prisma.pokemonInstance.create({
    data: {
      id: pokemon.instanceId,
      trainerId,

      speciesId: pokemon.speciesId,
      formId: pokemon.formId,
      nickname: pokemon.nickname ?? null,

      level: pokemon.level,
      experience: pokemon.experience,
      currentHp: pokemon.currentHp,
      abilityId: pokemon.abilityId,

      partyPosition,

      moves: pokemon.moves.length
        ? {
            create: pokemon.moves.map((move, slot) => ({
              slot,
              moveId: move.moveId,
              currentPp: move.currentPp,
            })),
          }
        : undefined,
    },
  });
}

async function createTestTrainer(prisma: PrismaService): Promise<string> {
  const trainerId = globalThis.crypto.randomUUID();

  await prisma.pokemonTrainer.create({
    data: {
      id: trainerId,

      /*
       * No necesitamos un session token real.
       * Sólo debe cumplir el unique constraint del fixture.
       */
      sessionTokenHash: `storage-smoke-${globalThis.crypto.randomUUID()}`,
    },
  });

  return trainerId;
}

async function getPersistedPositions(
  prisma: PrismaService,
  trainerId: string,
): Promise<Array<number | null>> {
  const rows = await prisma.pokemonInstance.findMany({
    where: {
      trainerId,
    },
    select: {
      partyPosition: true,
    },
  });

  return rows.map((row) => row.partyPosition);
}

async function main(): Promise<void> {
  const prisma = new PrismaService();

  await prisma.$connect();

  const testTrainerIds: string[] = [];

  try {
    console.log('');
    console.log('=== Pokémon Storage Persistence Smoke ===');
    console.log('');

    /*
     * ----------------------------------------------------
     * FIXTURE A
     *
     * 6 Party Pokémon
     * 1 Storage Pokémon
     * ----------------------------------------------------
     */

    const trainerId = await createTestTrainer(prisma);

    testTrainerIds.push(trainerId);

    const partyPokemon = PARTY_SPECIES.map((speciesId) =>
      createPokemonInstance(speciesId, TEST_LEVEL),
    );

    const storedPokemon = createPokemonInstance(STORED_SPECIES_ID, TEST_LEVEL);

    await prisma.$transaction(async () => {
      /*
       * PrismaService operations themselves are sufficient
       * for fixture creation here.
       *
       * The gameplay mutations below go through the real
       * Storage Service / Repository.
       */
    });

    for (
      let partyPosition = 0;
      partyPosition < partyPokemon.length;
      partyPosition += 1
    ) {
      const pokemon = partyPokemon[partyPosition];

      assert(pokemon, 'Party fixture Pokémon missing');

      await persistPokemon(prisma, trainerId, pokemon, partyPosition);
    }

    await persistPokemon(prisma, trainerId, storedPokemon, null);

    const partyRepository = new PokemonPartyRepository(prisma);
    const storageRepository = new PokemonStorageRepository(prisma);

    const trainerStateStore = new PokemonTrainerStateStore();

    const initialParty = await partyRepository.loadParty(trainerId);

    trainerStateStore.create(trainerId, initialParty);

    const storageService = new PokemonStorageService(
      trainerStateStore,
      partyRepository,
      storageRepository,
    );

    console.log('1. Initial Storage');

    const initialState = await storageService.getState(trainerId);

    assert(
      initialState.trainerState.party.pokemon.length === 6,
      'Initial Party should contain 6 Pokémon',
    );

    assert(
      initialState.storage.pokemon.length === 1,
      'Initial Storage should contain 1 Pokémon',
    );

    assert(
      initialState.storage.pokemon[0]?.instanceId === storedPokemon.instanceId,
      'Stored Pokémon should be Latios fixture instance',
    );

    console.log('✅ Party 6 / Storage 1');

    /*
     * ----------------------------------------------------
     * PARTY FULL
     * ----------------------------------------------------
     */

    console.log('');
    console.log('2. Withdraw while Party is full');

    await expectStorageError(
      () => storageService.withdraw(trainerId, storedPokemon.instanceId),
      'PARTY_FULL',
    );

    /*
     * ----------------------------------------------------
     * SWAP
     * ----------------------------------------------------
     */

    console.log('');
    console.log('3. Swap Storage ↔ Party');

    const swappedOutPokemon = partyPokemon[2];

    assert(swappedOutPokemon, 'Swap Party Pokémon fixture missing');

    const afterSwap = await storageService.swap(
      trainerId,
      storedPokemon.instanceId,
      swappedOutPokemon.instanceId,
    );

    assert(
      afterSwap.trainerState.party.pokemon.length === 6,
      'Party must remain size 6 after swap',
    );

    assert(
      afterSwap.storage.pokemon.some(
        (pokemon) => pokemon.instanceId === swappedOutPokemon.instanceId,
      ),
      'Swapped-out Party Pokémon should now be stored',
    );

    assert(
      afterSwap.trainerState.party.pokemon[2]?.instanceId ===
        storedPokemon.instanceId,
      'Stored Pokémon should inherit Party slot 2',
    );

    assertPartyPositions(
      await getPersistedPositions(prisma, trainerId),
      [0, 1, 2, 3, 4, 5],
    );

    console.log('✅ Swap preserves Party size and position');

    /*
     * ----------------------------------------------------
     * DEPOSIT + COMPACTION
     * ----------------------------------------------------
     */

    console.log('');
    console.log('4. Deposit + Party compaction');

    const pokemonToDeposit = partyPokemon[5];

    assert(pokemonToDeposit, 'Deposit fixture Pokémon missing');

    const afterDeposit = await storageService.deposit(
      trainerId,
      pokemonToDeposit.instanceId,
    );

    assert(
      afterDeposit.trainerState.party.pokemon.length === 5,
      'Party should contain 5 Pokémon after deposit',
    );

    assert(
      afterDeposit.storage.pokemon.some(
        (pokemon) => pokemon.instanceId === pokemonToDeposit.instanceId,
      ),
      'Deposited Pokémon must appear in Storage',
    );

    assertPartyPositions(
      await getPersistedPositions(prisma, trainerId),
      [0, 1, 2, 3, 4],
    );

    console.log('✅ Deposit stores Pokémon and compacts Party');

    /*
     * ----------------------------------------------------
     * WITHDRAW
     * ----------------------------------------------------
     */

    console.log('');
    console.log('5. Withdraw');

    const afterWithdraw = await storageService.withdraw(
      trainerId,
      pokemonToDeposit.instanceId,
    );

    assert(
      afterWithdraw.trainerState.party.pokemon.length === 6,
      'Party should return to size 6',
    );

    assert(
      !afterWithdraw.storage.pokemon.some(
        (pokemon) => pokemon.instanceId === pokemonToDeposit.instanceId,
      ),
      'Withdrawn Pokémon must no longer appear in Storage',
    );

    assertPartyPositions(
      await getPersistedPositions(prisma, trainerId),
      [0, 1, 2, 3, 4, 5],
    );

    console.log('✅ Withdraw restores Pokémon to Party');

    /*
     * ----------------------------------------------------
     * STALE COMMAND
     * ----------------------------------------------------
     */

    console.log('');
    console.log('6. Stale withdraw');

    await expectStorageError(
      () => storageService.withdraw(trainerId, pokemonToDeposit.instanceId),
      'STALE_COMMAND',
    );

    /*
     * ----------------------------------------------------
     * DOUBLE SUBMIT
     * ----------------------------------------------------
     */

    console.log('');
    console.log('7. Concurrent double submit');

    const doubleSubmitTarget = afterWithdraw.trainerState.party.pokemon[4];

    assert(doubleSubmitTarget, 'Double-submit target missing');

    const doubleSubmitResults = await Promise.allSettled([
      storageService.deposit(trainerId, doubleSubmitTarget.instanceId),
      storageService.deposit(trainerId, doubleSubmitTarget.instanceId),
    ]);

    const fulfilled = doubleSubmitResults.filter(
      (result) => result.status === 'fulfilled',
    );

    const rejected = doubleSubmitResults.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );

    assert(
      fulfilled.length === 1,
      `Exactly one double-submit request should succeed; received ${fulfilled.length}`,
    );

    assert(
      rejected.length === 1,
      `Exactly one double-submit request should fail; received ${rejected.length}`,
    );

    const doubleSubmitError = rejected[0]?.reason;

    assert(
      doubleSubmitError instanceof PokemonStoragePersistenceError,
      'Double-submit rejection should be PokemonStoragePersistenceError',
    );

    assert(
      doubleSubmitError.code === 'STALE_COMMAND',
      `Double-submit should reject as STALE_COMMAND, received ${doubleSubmitError.code}`,
    );

    console.log('✅ exactly one mutation committed');

    /*
     * ----------------------------------------------------
     * LAST PARTY POKÉMON
     * ----------------------------------------------------
     */

    console.log('');
    console.log('8. Last Party Pokémon protection');

    let current = await storageService.getState(trainerId);

    while (current.trainerState.party.pokemon.length > 1) {
      const candidate =
        current.trainerState.party.pokemon[
          current.trainerState.party.pokemon.length - 1
        ];

      assert(candidate, 'Party candidate missing during last-Pokémon test');

      current = await storageService.deposit(trainerId, candidate.instanceId);
    }

    const lastPokemon = current.trainerState.party.pokemon[0];

    assert(lastPokemon, 'Trainer should still own one active Party Pokémon');

    await expectStorageError(
      () => storageService.deposit(trainerId, lastPokemon.instanceId),
      'LAST_PARTY_POKEMON',
    );

    const finalParty = await partyRepository.loadParty(trainerId);

    assert(
      finalParty.pokemon.length === 1,
      'Last Party Pokémon must remain active after rejection',
    );

    console.log('✅ Party cannot become empty');

    /*
     * ----------------------------------------------------
     * INVALID OWNERSHIP
     * ----------------------------------------------------
     */

    console.log('');
    console.log('9. Cross-Trainer ownership protection');

    const otherTrainerId = await createTestTrainer(prisma);

    testTrainerIds.push(otherTrainerId);

    const foreignPokemon = createPokemonInstance(150, TEST_LEVEL);

    await persistPokemon(prisma, otherTrainerId, foreignPokemon, null);

    await expectStorageError(
      () => storageService.withdraw(trainerId, foreignPokemon.instanceId),
      'INVALID_POKEMON',
    );

    console.log('✅ foreign Pokémon cannot be moved');

    /*
     * ----------------------------------------------------
     * FINAL DB CHECK
     * ----------------------------------------------------
     */

    console.log('');
    console.log('10. Durable DB reconstruction');

    const reconstructedParty = await partyRepository.loadParty(trainerId);

    const reconstructedStorage = await storageRepository.loadStorage(trainerId);

    assert(
      reconstructedParty.pokemon.length === 1,
      'Reconstructed Party should contain exactly one Pokémon',
    );

    assert(
      reconstructedStorage.pokemon.length === 6,
      'Reconstructed Storage should contain six Pokémon',
    );

    console.log('✅ Party reconstructed directly from PostgreSQL');
    console.log('✅ Storage reconstructed directly from PostgreSQL');

    console.log('');
    console.log('======================================');
    console.log('POKÉMON STORAGE PERSISTENCE SMOKE ✅');
    console.log('======================================');
    console.log('');
  } finally {
    /*
     * Fixture isolation.
     *
     * Trainer cascade removes:
     * - PokemonInstance
     * - PokemonInstanceMove
     * - inventory rows
     */
    for (const trainerId of testTrainerIds) {
      await prisma.pokemonTrainer.deleteMany({
        where: {
          id: trainerId,
        },
      });
    }

    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error('');
  console.error('POKÉMON STORAGE PERSISTENCE SMOKE ❌');
  console.error(error);

  process.exitCode = 1;
});
