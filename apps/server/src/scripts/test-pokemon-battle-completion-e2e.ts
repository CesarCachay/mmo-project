import assert from 'node:assert/strict';

import { isPokemonBattleCompletedPayload } from '@cesar-mmo/shared';

function testValidWildDefeatPayload(): void {
  assert.equal(
    isPokemonBattleCompletedPayload({
      battleId: 'battle-completion-1',
      outcome: 'wild-defeated',
    }),
    true,
  );

  console.log('✅ Wild defeat completion payload valid');
}

function testValidTrainerDefeatPayload(): void {
  assert.equal(
    isPokemonBattleCompletedPayload({
      battleId: 'battle-completion-2',
      outcome: 'trainer-defeated',
    }),
    true,
  );

  console.log('✅ Trainer defeat completion payload valid');
}

function testInvalidBattleId(): void {
  assert.equal(
    isPokemonBattleCompletedPayload({
      battleId: '',
      outcome: 'wild-defeated',
    }),
    false,
  );

  console.log('✅ Empty Battle ID rejected');
}

function testInvalidOutcome(): void {
  assert.equal(
    isPokemonBattleCompletedPayload({
      battleId: 'battle-completion-3',
      outcome: 'continue',
    }),
    false,
  );

  assert.equal(
    isPokemonBattleCompletedPayload({
      battleId: 'battle-completion-3',
      outcome: 'trainer-replacement-required',
    }),
    false,
  );

  console.log('✅ Non-terminal outcomes rejected');
}

function testMalformedPayload(): void {
  assert.equal(isPokemonBattleCompletedPayload(null), false);

  assert.equal(
    isPokemonBattleCompletedPayload({
      outcome: 'wild-defeated',
    }),
    false,
  );

  assert.equal(
    isPokemonBattleCompletedPayload({
      battleId: 'battle-completion-4',
    }),
    false,
  );

  console.log('✅ Malformed completion payloads rejected');
}

function main(): void {
  testValidWildDefeatPayload();

  testValidTrainerDefeatPayload();

  testInvalidBattleId();

  testInvalidOutcome();

  testMalformedPayload();

  console.log('');

  console.log('============================================');

  console.log('✅ Pokemon BattleCompletion E2E smoke test passed');

  console.log('============================================');
}

main();
