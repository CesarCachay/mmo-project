import assert from 'node:assert/strict';

import {
  completeBattle,
  createPokemonInstance,
  resolveWildBattleContinuationOutcome,
  type BattleParticipant,
} from '@cesar-mmo/shared';

import { createWildBattleInstance } from '../pokemon/battles/pokemon-wild-battle.factory.js';

import type { PokemonWildEncounterSession } from '../pokemon/encounters/pokemon-wild-encounter-session.js';

function getParticipant(
  participants: readonly BattleParticipant[],
  type: 'trainer' | 'wild',
): BattleParticipant {
  const participant = participants.find((candidate) => candidate.type === type);

  assert.ok(participant, `${type} participant must exist`);

  return participant;
}

function createTestBattle(suffix: string) {
  const trainerPokemonOne = createPokemonInstance(4, 5);

  const trainerPokemonTwo = createPokemonInstance(7, 5);

  const wildPokemon = createPokemonInstance(19, 5);

  const encounterSession: PokemonWildEncounterSession = {
    encounterId: globalThis.crypto.randomUUID(),

    playerId: `continuation-player-${suffix}`,

    trainerId: `continuation-trainer-${suffix}`,

    mapId: 'route-01',

    zoneId: 'route-grass-zone-01',

    encounterTableId: 'town-grass',

    pokemon: wildPokemon,

    status: 'active',
  };

  const battle = createWildBattleInstance({
    encounterSession,

    trainerPokemon: [trainerPokemonOne, trainerPokemonTwo],
  });

  return {
    battle,

    trainer: getParticipant(battle.participants, 'trainer'),

    wild: getParticipant(battle.participants, 'wild'),
  };
}

function testContinue(): void {
  const { battle } = createTestBattle('continue');

  const outcome = resolveWildBattleContinuationOutcome(battle);

  assert.deepEqual(outcome, {
    type: 'continue',
  });

  console.log('✅ Battle continues when both active sides can fight');
}

function testTrainerReplacementRequired(): void {
  const { battle, trainer } = createTestBattle('replacement');

  assert.equal(trainer.activePokemonIndex, 0);

  const activePokemon = trainer.pokemon[0];

  assert.ok(activePokemon);

  activePokemon.currentHp = 0;

  const reservePokemon = trainer.pokemon[1];

  assert.ok(reservePokemon);

  assert.ok(reservePokemon.currentHp > 0);

  const outcome = resolveWildBattleContinuationOutcome(battle);

  assert.equal(outcome.type, 'trainer-replacement-required');

  if (outcome.type === 'trainer-replacement-required') {
    assert.deepEqual(outcome.replacementPokemonIndexes, [1]);
  }

  console.log(
    '✅ Trainer replacement required when active Pokémon faints but reserve exists',
  );
}

function testTrainerDefeated(): void {
  const { battle, trainer } = createTestBattle('trainer-defeated');

  for (const pokemon of trainer.pokemon) {
    pokemon.currentHp = 0;
  }

  const outcome = resolveWildBattleContinuationOutcome(battle);

  assert.deepEqual(outcome, {
    type: 'trainer-defeated',
  });

  console.log('✅ Trainer defeat detected');
}

function testWildDefeated(): void {
  const { battle, wild } = createTestBattle('wild-defeated');

  const wildPokemon = wild.pokemon[0];

  assert.ok(wildPokemon);

  wildPokemon.currentHp = 0;

  const outcome = resolveWildBattleContinuationOutcome(battle);

  assert.deepEqual(outcome, {
    type: 'wild-defeated',
  });

  console.log('✅ Wild defeat detected');
}

function testSimultaneousDefeatRejected(): void {
  const { battle, trainer, wild } = createTestBattle('double-defeat');

  for (const pokemon of trainer.pokemon) {
    pokemon.currentHp = 0;
  }

  const wildPokemon = wild.pokemon[0];

  assert.ok(wildPokemon);

  wildPokemon.currentHp = 0;

  assert.throws(() => {
    resolveWildBattleContinuationOutcome(battle);
  }, /simultaneous defeat is not supported yet/);

  console.log('✅ Unsupported simultaneous defeat rejected');
}

function testCompletedBattleRejected(): void {
  const { battle } = createTestBattle('completed');

  const completedBattle = completeBattle(battle);

  assert.throws(() => {
    resolveWildBattleContinuationOutcome(completedBattle);
  }, /Cannot resolve continuation/);

  console.log('✅ Completed Battle continuation rejected');
}

function main(): void {
  testContinue();

  testTrainerReplacementRequired();

  testTrainerDefeated();

  testWildDefeated();

  testSimultaneousDefeatRejected();

  testCompletedBattleRejected();

  console.log('');

  console.log('============================================');

  console.log('✅ Pokemon BattleContinuation smoke test passed');

  console.log('============================================');
}

main();
