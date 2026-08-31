import assert from 'node:assert/strict';

import type {
  BattleId,
  WildBattleContinuationOutcome,
} from '@cesar-mmo/shared';

import {
  applyPokemonWildBattleOutcome,
  type PokemonBattleCompletionStore,
  type PokemonBattleTurnCleanupStore,
} from '../pokemon/battles/pokemon-wild-battle-outcome.runtime.js';

class FakeBattleSessionStore implements PokemonBattleCompletionStore {
  readonly completedBattleIds: BattleId[] = [];

  complete(battleId: BattleId): void {
    this.completedBattleIds.push(battleId);
  }
}

class FakeBattleTurnStore implements PokemonBattleTurnCleanupStore {
  readonly removedBattleIds: BattleId[] = [];

  remove(battleId: BattleId): void {
    this.removedBattleIds.push(battleId);
  }
}

function execute(outcome: WildBattleContinuationOutcome) {
  const battleId = globalThis.crypto.randomUUID();

  const battleSessionStore = new FakeBattleSessionStore();

  const battleTurnStore = new FakeBattleTurnStore();

  const result = applyPokemonWildBattleOutcome({
    battleId,
    outcome,
    battleSessionStore,
    battleTurnStore,
  });

  return {
    battleId,
    result,
    battleSessionStore,
    battleTurnStore,
  };
}

function testContinueDoesNotCompleteBattle(): void {
  const context = execute({
    type: 'continue',
  });

  assert.deepEqual(context.battleSessionStore.completedBattleIds, []);

  assert.deepEqual(context.battleTurnStore.removedBattleIds, []);

  assert.equal(context.result.type, 'continue');

  assert.equal(context.result.battleCompleted, false);

  console.log('✅ Continue keeps Battle and Turn active');
}

function testReplacementDoesNotCompleteBattle(): void {
  const context = execute({
    type: 'trainer-replacement-required',

    replacementPokemonIndexes: [1, 2],
  });

  assert.deepEqual(context.battleSessionStore.completedBattleIds, []);

  assert.deepEqual(context.battleTurnStore.removedBattleIds, []);

  assert.equal(context.result.type, 'trainer-replacement-required');

  assert.equal(context.result.battleCompleted, false);

  if (context.result.type === 'trainer-replacement-required') {
    assert.deepEqual(context.result.replacementPokemonIndexes, [1, 2]);
  }

  console.log('✅ Replacement requirement keeps Battle active');
}

function testTrainerDefeatCompletesBattle(): void {
  const context = execute({
    type: 'trainer-defeated',
  });

  assert.deepEqual(context.battleSessionStore.completedBattleIds, [
    context.battleId,
  ]);

  assert.deepEqual(context.battleTurnStore.removedBattleIds, [
    context.battleId,
  ]);

  assert.equal(context.result.type, 'trainer-defeated');

  assert.equal(context.result.battleCompleted, true);

  console.log('✅ Trainer defeat completes Battle and removes Turn');
}

function testWildDefeatCompletesBattle(): void {
  const context = execute({
    type: 'wild-defeated',
  });

  assert.deepEqual(context.battleSessionStore.completedBattleIds, [
    context.battleId,
  ]);

  assert.deepEqual(context.battleTurnStore.removedBattleIds, [
    context.battleId,
  ]);

  assert.equal(context.result.type, 'wild-defeated');

  assert.equal(context.result.battleCompleted, true);

  console.log('✅ Wild defeat completes Battle and removes Turn');
}

function main(): void {
  testContinueDoesNotCompleteBattle();

  testReplacementDoesNotCompleteBattle();

  testTrainerDefeatCompletesBattle();

  testWildDefeatCompletesBattle();

  console.log('');

  console.log('============================================');

  console.log('✅ Pokemon WildBattleOutcomeRuntime smoke test passed');

  console.log('============================================');
}

main();
