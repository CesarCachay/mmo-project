import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import {
  createPokemonInstance,
  getExperienceForLevel,
  getPokemonLearnset,
  getPokemonSpecies,
  planPokemonProgression,
} from '@cesar-mmo/shared';

import type {
  PokemonInstance,
  PokemonInstanceMove,
  PokemonTrainerState,
} from '@cesar-mmo/shared';

import { PrismaService } from '../database/prisma.service';

import { PokemonPartyRepository } from '../pokemon/pokemon-party.repository';

import { PokemonTrainerStateStore } from '../pokemon/pokemon-trainer-state.store';

import {
  PokemonProgressionError,
  PokemonProgressionService,
} from '../pokemon/progression/pokemon-progression.service';

import { PokemonProgressionRepository } from '../pokemon/progression/pokemon-progression.repository';

import { PokemonProgressionOperationQueue } from '../pokemon/progression/pokemon-progression-operation.queue';

import { PokemonPendingMoveLearningRepository } from '../pokemon/progression/pokemon-pending-move-learning.repository';

import { PokemonPendingMoveLearningStore } from '../pokemon/progression/pokemon-pending-move-learning.store';

import { PokemonPendingMoveLearningService } from '../pokemon/progression/pokemon-pending-move-learning.service';

import { PokemonProgressionManager } from '../pokemon/progression/pokemon-progression.manager';

/*
 * ============================================================
 * SMOKE MODULE
 * ============================================================
 *
 * Important:
 *
 * We intentionally DO NOT bootstrap GameModule.
 *
 * This smoke validates only:
 *
 * ProgressionManager
 * → Progression services
 * → repositories
 * → stores
 * → PostgreSQL
 *
 * No:
 *
 * GameGateway
 * game loop
 * sockets
 * battle runtime
 * world runtime
 * ============================================================
 */

@Module({
  providers: [
    PrismaService,

    PokemonPartyRepository,
    PokemonTrainerStateStore,

    PokemonProgressionOperationQueue,

    PokemonProgressionRepository,
    PokemonProgressionService,

    PokemonPendingMoveLearningRepository,
    PokemonPendingMoveLearningStore,
    PokemonPendingMoveLearningService,

    PokemonProgressionManager,
  ],
})
class PokemonProgressionSmokeModule {}

/*
 * ============================================================
 * TYPES
 * ============================================================
 */

interface PendingProgressionFixture {
  readonly pokemon: PokemonInstance;

  readonly gainedExperience: number;

  readonly speciesName: string;

  readonly targetLevel: number;
}

/*
 * ============================================================
 * ASSERT
 * ============================================================
 */

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

/*
 * ============================================================
 * CLONE
 * ============================================================
 */

function clonePokemon(pokemon: PokemonInstance): PokemonInstance {
  return {
    ...pokemon,

    moves: pokemon.moves.map((move) => ({
      ...move,
    })),
  };
}

/*
 * ============================================================
 * FIXTURE SEARCH
 * ============================================================
 *
 * Search actual imported Pokémon data for a real progression
 * that produces:
 *
 * 4 known moves
 * +
 * level-up
 * +
 * new move
 * =
 * pending-decision
 *
 * This avoids hardcoding one particular Pokémon.
 * ============================================================
 */

function findPendingProgressionFixture(): PendingProgressionFixture {
  for (let speciesId = 1; speciesId <= 493; speciesId += 1) {
    const species = getPokemonSpecies(speciesId);

    const learnset = getPokemonLearnset(speciesId);

    if (!species || !learnset) {
      continue;
    }

    const entries = [...learnset.levelUpMoves].sort((a, b) => {
      if (a.level !== b.level) {
        return a.level - b.level;
      }

      return a.moveId - b.moveId;
    });

    for (const entry of entries) {
      if (entry.level <= 1 || entry.level > 100) {
        continue;
      }

      const previousLevel = entry.level - 1;

      const pokemon = createPokemonInstance(speciesId, previousLevel);

      /*
       * This smoke specifically wants to exercise
       * the full-moves pending branch.
       */
      if (pokemon.moves.length !== 4) {
        continue;
      }

      const targetExperience = getExperienceForLevel(
        species.growthRate,
        entry.level,
      );

      const gainedExperience = targetExperience - pokemon.experience;

      if (gainedExperience <= 0) {
        continue;
      }

      const progression = planPokemonProgression({
        pokemon,

        growthRate: species.growthRate,

        gainedExperience,
      });

      if (progression.moveLearning.status !== 'pending-decision') {
        continue;
      }

      return {
        pokemon,

        gainedExperience,

        speciesName: species.name,

        targetLevel: progression.experience.currentLevel,
      };
    }
  }

  throw new Error(
    [
      'Could not find a Pokémon progression fixture',
      'that produces a pending move-learning decision.',
    ].join(' '),
  );
}

/*
 * ============================================================
 * DATABASE FIXTURES
 * ============================================================
 */

async function createTestTrainer(prisma: PrismaService): Promise<string> {
  const trainerId = globalThis.crypto.randomUUID();

  await prisma.pokemonTrainer.create({
    data: {
      id: trainerId,

      /*
       * Smoke-only unique value.
       * No raw session token is required.
       */
      sessionTokenHash: `progression-smoke-${globalThis.crypto.randomUUID()}`,
    },
  });

  return trainerId;
}

async function persistPartyPokemon(
  prisma: PrismaService,

  trainerId: string,

  pokemon: PokemonInstance,
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

      partyPosition: 0,

      moves:
        pokemon.moves.length > 0
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

/*
 * ============================================================
 * CLEANUP
 * ============================================================
 */

async function cleanupTrainer(
  prisma: PrismaService,

  trainerId: string,
): Promise<void> {
  const pokemonRows = await prisma.pokemonInstance.findMany({
    where: {
      trainerId,
    },

    select: {
      id: true,
    },
  });

  const pokemonInstanceIds = pokemonRows.map((pokemon) => pokemon.id);

  if (pokemonInstanceIds.length > 0) {
    await prisma.pokemonPendingMoveLearning.deleteMany({
      where: {
        pokemonInstanceId: {
          in: pokemonInstanceIds,
        },
      },
    });

    await prisma.pokemonInstanceMove.deleteMany({
      where: {
        pokemonInstanceId: {
          in: pokemonInstanceIds,
        },
      },
    });

    await prisma.pokemonInstance.deleteMany({
      where: {
        trainerId,
      },
    });
  }

  await prisma.pokemonTrainer.deleteMany({
    where: {
      id: trainerId,
    },
  });
}

/*
 * ============================================================
 * TRAINER STATE HELPERS
 * ============================================================
 */

function getPartyPokemon(
  trainerState: PokemonTrainerState,

  pokemonInstanceId: string,
): PokemonInstance {
  const pokemon = trainerState.party.pokemon.find(
    (entry) => entry.instanceId === pokemonInstanceId,
  );

  assert(
    pokemon,

    `Pokémon "${pokemonInstanceId}" is missing from TrainerState Party`,
  );

  return pokemon;
}

function assertMovesEqual(
  actual: readonly PokemonInstanceMove[],

  expected: readonly PokemonInstanceMove[],

  context: string,
): void {
  assert(
    actual.length === expected.length,

    [
      context,
      `move count differs (${actual.length} !== ${expected.length})`,
    ].join(': '),
  );

  for (let slot = 0; slot < expected.length; slot += 1) {
    const actualMove = actual[slot];

    const expectedMove = expected[slot];

    assert(actualMove, `${context}: actual move missing at slot ${slot}`);

    assert(expectedMove, `${context}: expected move missing at slot ${slot}`);

    assert(
      actualMove.moveId === expectedMove.moveId,

      [
        `${context}: wrong move at slot ${slot}`,
        `${actualMove.moveId} !== ${expectedMove.moveId}`,
      ].join(' '),
    );

    assert(
      actualMove.currentPp === expectedMove.currentPp,

      [
        `${context}: wrong PP at slot ${slot}`,
        `${actualMove.currentPp} !== ${expectedMove.currentPp}`,
      ].join(' '),
    );
  }
}

/*
 * ============================================================
 * DATABASE ↔ RAM CHECK
 * ============================================================
 */

async function assertDatabaseMatchesRuntime(
  prisma: PrismaService,

  trainerStateStore: PokemonTrainerStateStore,

  trainerId: string,

  pokemonInstanceId: string,
): Promise<void> {
  const trainerState = trainerStateStore.get(trainerId);

  assert(
    trainerState,

    `TrainerState "${trainerId}" does not exist`,
  );

  const runtimePokemon = getPartyPokemon(trainerState, pokemonInstanceId);

  const persistedPokemon = await prisma.pokemonInstance.findUnique({
    where: {
      id: pokemonInstanceId,
    },

    include: {
      moves: {
        orderBy: {
          slot: 'asc',
        },
      },
    },
  });

  assert(
    persistedPokemon,

    `Persisted Pokémon "${pokemonInstanceId}" does not exist`,
  );

  assert(
    persistedPokemon.trainerId === trainerId,

    'Persisted Pokémon belongs to another Trainer',
  );

  assert(
    persistedPokemon.level === runtimePokemon.level,

    [
      'DB/RAM level mismatch:',
      `${persistedPokemon.level} !== ${runtimePokemon.level}`,
    ].join(' '),
  );

  assert(
    persistedPokemon.experience === runtimePokemon.experience,

    [
      'DB/RAM experience mismatch:',
      `${persistedPokemon.experience} !== ${runtimePokemon.experience}`,
    ].join(' '),
  );

  assert(
    persistedPokemon.currentHp === runtimePokemon.currentHp,

    [
      'DB/RAM currentHp mismatch:',
      `${persistedPokemon.currentHp} !== ${runtimePokemon.currentHp}`,
    ].join(' '),
  );

  const persistedMoves: PokemonInstanceMove[] = persistedPokemon.moves.map(
    (move) => ({
      moveId: move.moveId,

      currentPp: move.currentPp,
    }),
  );

  assertMovesEqual(persistedMoves, runtimePokemon.moves, 'DB/RAM moves');
}

/*
 * ============================================================
 * COMPLETE REMAINING MOVE DECISIONS
 * ============================================================
 */

async function cancelRemainingPendingDecisions(
  progressionManager: PokemonProgressionManager,

  trainerId: string,

  pokemonInstanceId: string,

  initialHasNextPendingDecision: boolean,
): Promise<void> {
  let hasNextPendingDecision = initialHasNextPendingDecision;

  let safety = 0;

  while (hasNextPendingDecision) {
    safety += 1;

    assert(
      safety <= 20,

      'Move-learning continuation exceeded safety limit',
    );

    const result = await progressionManager.resolveMoveLearningDecision({
      trainerId,

      pokemonInstanceId,

      decision: {
        type: 'cancel',
      },
    });

    hasNextPendingDecision = result.hasNextPendingDecision;
  }
}

/*
 * ============================================================
 * SCENARIO 1
 *
 * EXP
 * → Level Up
 * → Pending
 * → extra EXP blocked
 * → RAM loss
 * → reload Party
 * → resolve persisted pending
 * → CANCEL
 * ============================================================
 */

async function runCancelScenario(
  prisma: PrismaService,

  progressionManager: PokemonProgressionManager,

  pendingRepository: PokemonPendingMoveLearningRepository,

  pendingStore: PokemonPendingMoveLearningStore,

  trainerStateStore: PokemonTrainerStateStore,

  partyRepository: PokemonPartyRepository,

  trainerIds: string[],
): Promise<void> {
  console.log('1. Pending + CANCEL + restart hydration');

  console.log('   searching compatible Pokémon fixture...');

  const fixture = findPendingProgressionFixture();

  const trainerId = await createTestTrainer(prisma);

  trainerIds.push(trainerId);

  const pokemon = clonePokemon(fixture.pokemon);

  await persistPartyPokemon(prisma, trainerId, pokemon);

  trainerStateStore.create(
    trainerId,

    {
      pokemon: [clonePokemon(pokemon)],
    },
  );

  console.log(
    [
      '   fixture:',
      fixture.speciesName,
      `Lv.${pokemon.level}`,
      '→',
      `Lv.${fixture.targetLevel}`,
    ].join(' '),
  );

  /*
   * --------------------------------------------------------
   * APPLY EXPERIENCE
   * --------------------------------------------------------
   */

  const result = await progressionManager.applyExperience({
    trainerId,

    pokemonInstanceId: pokemon.instanceId,

    gainedExperience: fixture.gainedExperience,
  });

  assert(
    result.progression.requiresMoveLearningDecision,

    'Progression should require a pending move-learning decision',
  );

  assert(
    result.progression.experience.currentLevel === fixture.targetLevel,

    [
      'Unexpected resulting level.',
      `Expected ${fixture.targetLevel},`,
      `received ${result.progression.experience.currentLevel}`,
    ].join(' '),
  );

  await assertDatabaseMatchesRuntime(
    prisma,

    trainerStateStore,

    trainerId,

    pokemon.instanceId,
  );

  /*
   * --------------------------------------------------------
   * PENDING PERSISTENCE
   * --------------------------------------------------------
   */

  const persistedPending = await pendingRepository.findByPokemonInstanceId(
    trainerId,

    pokemon.instanceId,
  );

  assert(
    persistedPending,

    'Pending move-learning state should exist in PostgreSQL',
  );

  assert(
    persistedPending.revision === 0,

    [
      'Initial pending revision should be 0.',
      `Received ${persistedPending.revision}`,
    ].join(' '),
  );

  console.log('   ✅ level / EXP / HP / moves / pending persisted');

  /*
   * --------------------------------------------------------
   * ADDITIONAL EXP MUST FAIL
   * --------------------------------------------------------
   */

  let blocked = false;

  try {
    await progressionManager.applyExperience({
      trainerId,

      pokemonInstanceId: pokemon.instanceId,

      gainedExperience: 1,
    });
  } catch (error: unknown) {
    if (!(error instanceof PokemonProgressionError)) {
      throw error;
    }

    assert(
      error.code === 'PENDING_MOVE_LEARNING',

      ['Expected PENDING_MOVE_LEARNING.', `Received ${error.code}`].join(' '),
    );

    blocked = true;
  }

  assert(
    blocked,

    'Additional EXP should have been blocked',
  );

  console.log('   ✅ additional EXP blocked while pending');

  /*
   * --------------------------------------------------------
   * SIMULATED SERVER RESTART
   * --------------------------------------------------------
   *
   * Drop runtime caches.
   *
   * PostgreSQL remains untouched.
   */

  pendingStore.clear();

  trainerStateStore.remove(trainerId);

  const reloadedParty = await partyRepository.loadParty(trainerId);

  trainerStateStore.create(trainerId, reloadedParty);

  /*
   * Pending Store is currently empty.
   *
   * resolveMoveLearningDecision()
   *
   * should:
   *
   * Manager
   * → Pending Service
   * → DB Repository
   * → restore pending
   */

  const movesBeforeCancel = getPartyPokemon(
    trainerStateStore.get(trainerId)!,
    pokemon.instanceId,
  ).moves.map((move) => ({
    ...move,
  }));

  const cancelResult = await progressionManager.resolveMoveLearningDecision({
    trainerId,

    pokemonInstanceId: pokemon.instanceId,

    decision: {
      type: 'cancel',
    },
  });

  console.log('   ✅ pending restored from PostgreSQL after RAM loss');

  const stateAfterCancel = trainerStateStore.get(trainerId);

  assert(
    stateAfterCancel,

    'TrainerState missing after CANCEL',
  );

  const pokemonAfterCancel = getPartyPokemon(
    stateAfterCancel,
    pokemon.instanceId,
  );

  /*
   * Cancelling current candidate must not replace
   * one of the four existing moves.
   */
  assertMovesEqual(
    pokemonAfterCancel.moves,
    movesBeforeCancel,
    'CANCEL current candidate',
  );

  console.log('   ✅ CANCEL preserved current moves');

  /*
   * A level jump could theoretically leave more
   * pending candidates. Cancel those too.
   */

  await cancelRemainingPendingDecisions(
    progressionManager,

    trainerId,

    pokemon.instanceId,

    cancelResult.hasNextPendingDecision,
  );

  const finalPending = await prisma.pokemonPendingMoveLearning.findUnique({
    where: {
      pokemonInstanceId: pokemon.instanceId,
    },
  });

  assert(
    finalPending === null,

    'Pending row should be removed when workflow finishes',
  );

  await assertDatabaseMatchesRuntime(
    prisma,

    trainerStateStore,

    trainerId,

    pokemon.instanceId,
  );

  console.log('   ✅ CANCEL continuation completed');

  console.log('   ✅ PostgreSQL / RAM consistent');
}

/*
 * ============================================================
 * SCENARIO 2
 *
 * EXP
 * → pending
 * → choose existing slot 0
 * → FORGET
 * → new candidate replaces slot 0
 * → next pending revision if necessary
 * → finish workflow
 * ============================================================
 */

async function runForgetScenario(
  prisma: PrismaService,

  progressionManager: PokemonProgressionManager,

  pendingRepository: PokemonPendingMoveLearningRepository,

  trainerStateStore: PokemonTrainerStateStore,

  trainerIds: string[],
): Promise<void> {
  console.log('2. Pending + FORGET');

  const fixture = findPendingProgressionFixture();

  const trainerId = await createTestTrainer(prisma);

  trainerIds.push(trainerId);

  const pokemon = clonePokemon(fixture.pokemon);

  await persistPartyPokemon(prisma, trainerId, pokemon);

  trainerStateStore.create(
    trainerId,

    {
      pokemon: [clonePokemon(pokemon)],
    },
  );

  await progressionManager.applyExperience({
    trainerId,

    pokemonInstanceId: pokemon.instanceId,

    gainedExperience: fixture.gainedExperience,
  });

  /*
   * Get the real persisted candidate.
   */

  const pending = await pendingRepository.findByPokemonInstanceId(
    trainerId,

    pokemon.instanceId,
  );

  assert(
    pending,

    'Pending row missing before FORGET',
  );

  const candidateMoveId = pending.candidate.moveId;

  const stateBeforeForget = trainerStateStore.get(trainerId);

  assert(
    stateBeforeForget,

    'TrainerState missing before FORGET',
  );

  const pokemonBeforeForget = getPartyPokemon(
    stateBeforeForget,

    pokemon.instanceId,
  );

  assert(
    pokemonBeforeForget.moves.length === 4,

    [
      'Expected exactly 4 moves.',
      `Received ${pokemonBeforeForget.moves.length}`,
    ].join(' '),
  );

  /*
   * Deliberately replace slot 0.
   */

  const moveToForget = pokemonBeforeForget.moves[0];

  assert(
    moveToForget,

    'Move slot 0 missing',
  );

  assert(
    moveToForget.moveId !== candidateMoveId,

    'Candidate move is unexpectedly already known',
  );

  const oldMoveId = moveToForget.moveId;

  const forgetResult = await progressionManager.resolveMoveLearningDecision({
    trainerId,

    pokemonInstanceId: pokemon.instanceId,

    decision: {
      type: 'forget',

      moveId: oldMoveId,
    },
  });

  const stateAfterForget = trainerStateStore.get(trainerId);

  assert(
    stateAfterForget,

    'TrainerState missing after FORGET',
  );

  const pokemonAfterForget = getPartyPokemon(
    stateAfterForget,

    pokemon.instanceId,
  );

  assert(
    pokemonAfterForget.moves.length === 4,

    'FORGET should preserve four move slots',
  );

  const replacement = pokemonAfterForget.moves[0];

  assert(
    replacement,

    'Move slot 0 missing after FORGET',
  );

  assert(
    replacement.moveId === candidateMoveId,

    [
      'Candidate did not replace selected slot.',
      `Expected moveId ${candidateMoveId},`,
      `received ${replacement.moveId}`,
    ].join(' '),
  );

  assert(
    !pokemonAfterForget.moves.some((move) => move.moveId === oldMoveId),

    `Forgotten move "${oldMoveId}" still exists`,
  );

  await assertDatabaseMatchesRuntime(
    prisma,

    trainerStateStore,

    trainerId,

    pokemon.instanceId,
  );

  console.log('   ✅ FORGET replaced exact selected slot');

  console.log('   ✅ move replacement persisted');

  /*
   * --------------------------------------------------------
   * REVISION
   * --------------------------------------------------------
   */

  if (forgetResult.hasNextPendingDecision) {
    const nextPending = await pendingRepository.findByPokemonInstanceId(
      trainerId,

      pokemon.instanceId,
    );

    assert(
      nextPending,

      'Expected another persisted pending candidate',
    );

    assert(
      nextPending.revision === pending.revision + 1,

      [
        'Pending revision did not increment.',
        `Expected ${pending.revision + 1},`,
        `received ${nextPending.revision}`,
      ].join(' '),
    );

    console.log('   ✅ pending revision incremented');
  }

  /*
   * Complete remaining candidates.
   */

  await cancelRemainingPendingDecisions(
    progressionManager,

    trainerId,

    pokemon.instanceId,

    forgetResult.hasNextPendingDecision,
  );

  const finalPending = await prisma.pokemonPendingMoveLearning.findUnique({
    where: {
      pokemonInstanceId: pokemon.instanceId,
    },
  });

  assert(
    finalPending === null,

    'Pending row should be removed after workflow completion',
  );

  await assertDatabaseMatchesRuntime(
    prisma,

    trainerStateStore,

    trainerId,

    pokemon.instanceId,
  );

  console.log('   ✅ pending workflow removed after completion');

  console.log('   ✅ final PostgreSQL / RAM state consistent');
}

/*
 * ============================================================
 * MAIN
 * ============================================================
 */

async function main(): Promise<void> {
  console.log('');
  console.log('[Progression Smoke] Bootstrapping isolated Nest context...');

  const app = await NestFactory.createApplicationContext(
    PokemonProgressionSmokeModule,

    {
      logger: false,
    },
  );

  console.log('[Progression Smoke] Nest context ready ✅');

  const prisma = app.get(PrismaService);

  const progressionManager = app.get(PokemonProgressionManager);

  /*
   * Infrastructure dependencies are only used
   * for verification.
   *
   * Gameplay commands always go through Manager.
   */

  const pendingRepository = app.get(PokemonPendingMoveLearningRepository);

  const pendingStore = app.get(PokemonPendingMoveLearningStore);

  const trainerStateStore = app.get(PokemonTrainerStateStore);

  const partyRepository = app.get(PokemonPartyRepository);

  const trainerIds: string[] = [];

  try {
    console.log('[Progression Smoke] Connecting PostgreSQL...');

    await prisma.$connect();

    console.log('[Progression Smoke] PostgreSQL connected ✅');

    console.log('');
    console.log('=== Pokémon Progression Persistence Smoke ===');
    console.log('');

    /*
     * ------------------------------------------------------
     * SCENARIO 1
     * ------------------------------------------------------
     */

    await runCancelScenario(
      prisma,

      progressionManager,

      pendingRepository,

      pendingStore,

      trainerStateStore,

      partyRepository,

      trainerIds,
    );

    console.log('');

    /*
     * ------------------------------------------------------
     * SCENARIO 2
     * ------------------------------------------------------
     */

    await runForgetScenario(
      prisma,

      progressionManager,

      pendingRepository,

      trainerStateStore,

      trainerIds,
    );

    console.log('');
    console.log('POKÉMON PROGRESSION PERSISTENCE SMOKE ✅');
    console.log('');
  } finally {
    console.log('');
    console.log('[Progression Smoke] Cleaning fixtures...');

    trainerStateStore.clear();

    pendingStore.clear();

    for (const trainerId of trainerIds) {
      await cleanupTrainer(prisma, trainerId);
    }

    console.log('[Progression Smoke] Cleanup complete ✅');

    await app.close();
  }
}

/*
 * ============================================================
 * ENTRYPOINT
 * ============================================================
 */

main().catch((error: unknown) => {
  console.error('');
  console.error('POKÉMON PROGRESSION PERSISTENCE SMOKE ❌');

  console.error(error);

  process.exitCode = 1;
});
