import assert from 'node:assert/strict';

import {
  addBattleTurnCommand,
  createBattleCommand,
  createBattleMoveExecutionContext,
  createBattleTurn,
  createBattleTurnResolutionOrder,
  createPokemonInstance,
  getActiveBattlePokemon,
  resolveBattleMoveAccuracy,
  type BattleMoveExecutionContext,
  type BattleParticipant,
} from '@cesar-mmo/shared';

import { createWildBattleInstance } from '../pokemon/battles/pokemon-wild-battle.factory.js';

import type { PokemonWildEncounterSession } from '../pokemon/encounters/pokemon-wild-encounter-session.js';

const TACKLE_MOVE_ID = 33;

function getParticipant(
  participants: readonly BattleParticipant[],
  type: 'trainer' | 'wild',
): BattleParticipant {
  const participant = participants.find((candidate) => candidate.type === type);

  assert.ok(participant, `${type} participant must exist`);

  return participant;
}

function createTestBattle() {
  const trainerPokemon = createPokemonInstance(4, 5);

  const wildPokemon = createPokemonInstance(19, 5);

  const encounterSession: PokemonWildEncounterSession = {
    encounterId: globalThis.crypto.randomUUID(),

    playerId: 'accuracy-player',

    trainerId: 'accuracy-trainer',

    mapId: 'route-01',

    zoneId: 'route-grass-zone-01',

    encounterTableId: 'town-grass',

    pokemon: wildPokemon,

    status: 'active',
  };

  const battle = createWildBattleInstance({
    encounterSession,

    trainerPokemon: [trainerPokemon],
  });

  const trainerParticipant = getParticipant(battle.participants, 'trainer');

  const wildParticipant = getParticipant(battle.participants, 'wild');

  return {
    battle,
    trainerParticipant,
    wildParticipant,
  };
}

function setMove(participant: BattleParticipant, moveId: number): void {
  const activePokemon = getActiveBattlePokemon(participant);

  activePokemon.pokemon.moves = [
    {
      moveId,
      currentPp: 10,
    },
  ];
}

function createExecutionContext(): BattleMoveExecutionContext {
  const context = createTestBattle();

  setMove(context.trainerParticipant, TACKLE_MOVE_ID);

  setMove(context.wildParticipant, TACKLE_MOVE_ID);

  const trainerCommand = createBattleCommand(context.battle, {
    participantId: context.trainerParticipant.id,

    action: {
      type: 'use-move',

      moveId: TACKLE_MOVE_ID,
    },
  });

  const wildCommand = createBattleCommand(context.battle, {
    participantId: context.wildParticipant.id,

    action: {
      type: 'use-move',

      moveId: TACKLE_MOVE_ID,
    },
  });

  let turn = createBattleTurn(context.battle, 1);

  turn = addBattleTurnCommand(context.battle, turn, trainerCommand);

  turn = addBattleTurnCommand(context.battle, turn, wildCommand);

  const resolutionOrder = createBattleTurnResolutionOrder(
    context.battle,
    turn,
    () => 0.5,
  );

  const entry = resolutionOrder.entries[0];

  assert.ok(entry, 'Resolution entry must exist');

  return createBattleMoveExecutionContext(context.battle, entry);
}

function withAccuracy(
  context: BattleMoveExecutionContext,

  accuracy: number | null,
): BattleMoveExecutionContext {
  return {
    ...context,

    move: {
      ...context.move,
      accuracy,
    },
  };
}

function testAccuracy100(): void {
  const context = withAccuracy(createExecutionContext(), 100);

  const result = resolveBattleMoveAccuracy(context, () => 0.999);

  assert.equal(result.hit, true);

  assert.equal(result.accuracy, 100);

  assert.equal(result.roll, 0.999);

  console.log('✅ Accuracy 100 always hits for valid RNG');
}

function testHitBelowThreshold(): void {
  const context = withAccuracy(createExecutionContext(), 80);

  const result = resolveBattleMoveAccuracy(context, () => 0.79);

  assert.equal(result.hit, true);

  assert.equal(result.accuracy, 80);

  assert.equal(result.roll, 0.79);

  console.log('✅ Roll below accuracy threshold hits');
}

function testMissAboveThreshold(): void {
  const context = withAccuracy(createExecutionContext(), 80);

  const result = resolveBattleMoveAccuracy(context, () => 0.8);

  assert.equal(result.hit, false);

  assert.equal(result.accuracy, 80);

  assert.equal(result.roll, 0.8);

  console.log('✅ Roll at/above threshold misses');
}

function testNullAccuracy(): void {
  const context = withAccuracy(createExecutionContext(), null);

  let randomCalled = false;

  const result = resolveBattleMoveAccuracy(context, () => {
    randomCalled = true;

    return 0.999;
  });

  assert.equal(result.hit, true);

  assert.equal(result.accuracy, null);

  assert.equal(result.roll, null);

  assert.equal(randomCalled, false);

  console.log('✅ Null accuracy hits without consuming RNG');
}

function testInvalidRandomValues(): void {
  const context = withAccuracy(createExecutionContext(), 80);

  assert.throws(() => {
    resolveBattleMoveAccuracy(context, () => -0.1);
  }, /Invalid battle accuracy random value/);

  assert.throws(() => {
    resolveBattleMoveAccuracy(context, () => 1);
  }, /Invalid battle accuracy random value/);

  assert.throws(() => {
    resolveBattleMoveAccuracy(context, () => Number.NaN);
  }, /Invalid battle accuracy random value/);

  console.log('✅ Invalid accuracy RNG rejected');
}

function testInvalidAccuracy(): void {
  const baseContext = createExecutionContext();

  for (const accuracy of [0, -1, 101, Number.NaN]) {
    const context = withAccuracy(baseContext, accuracy);

    assert.throws(() => {
      resolveBattleMoveAccuracy(context, () => 0.5);
    }, /Invalid move accuracy/);
  }

  console.log('✅ Invalid static accuracy rejected');
}

function main(): void {
  testAccuracy100();

  testHitBelowThreshold();

  testMissAboveThreshold();

  testNullAccuracy();

  testInvalidRandomValues();

  testInvalidAccuracy();

  console.log('');

  console.log('============================================');

  console.log('✅ Pokemon BattleMoveAccuracy smoke test passed');

  console.log('============================================');
}

main();
