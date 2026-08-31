import assert from 'node:assert/strict';

import {
  addBattleTurnCommand,
  applyBattleMoveDamage,
  calculateBattleMoveDamage,
  createBattleCommand,
  createBattleMoveExecutionContext,
  createBattleTurn,
  createBattleTurnResolutionOrder,
  createPokemonInstance,
  getActiveBattlePokemon,
  type BattleMoveDamageResult,
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

function createExecutionContext(): BattleMoveExecutionContext {
  const trainerPokemon = createPokemonInstance(4, 5);

  const wildPokemon = createPokemonInstance(19, 5);

  const encounterSession: PokemonWildEncounterSession = {
    encounterId: globalThis.crypto.randomUUID(),

    playerId: 'damage-application-player',

    trainerId: 'damage-application-trainer',

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

  const trainer = getParticipant(battle.participants, 'trainer');

  const wild = getParticipant(battle.participants, 'wild');

  getActiveBattlePokemon(trainer).pokemon.moves = [
    {
      moveId: TACKLE_MOVE_ID,

      currentPp: 10,
    },
  ];

  getActiveBattlePokemon(wild).pokemon.moves = [
    {
      moveId: TACKLE_MOVE_ID,

      currentPp: 10,
    },
  ];

  const trainerCommand = createBattleCommand(battle, {
    participantId: trainer.id,

    action: {
      type: 'use-move',

      moveId: TACKLE_MOVE_ID,
    },
  });

  const wildCommand = createBattleCommand(battle, {
    participantId: wild.id,

    action: {
      type: 'use-move',

      moveId: TACKLE_MOVE_ID,
    },
  });

  let turn = createBattleTurn(battle, 1);

  turn = addBattleTurnCommand(battle, turn, trainerCommand);

  turn = addBattleTurnCommand(battle, turn, wildCommand);

  const order = createBattleTurnResolutionOrder(battle, turn, () => 0.5);

  const trainerEntry = order.entries.find(
    (entry) => entry.command.participantId === trainer.id,
  );

  assert.ok(trainerEntry, 'Trainer resolution entry must exist');

  return createBattleMoveExecutionContext(battle, trainerEntry);
}

function createDamageResult(damage: number): BattleMoveDamageResult {
  return {
    damage,

    power: 40,

    attack: 50,

    defense: 40,

    damageClass: 'physical',
  };
}

function testNormalDamage(): void {
  const context = createExecutionContext();

  context.targetPokemon.currentHp = 20;

  const result = applyBattleMoveDamage(context, createDamageResult(6));

  assert.equal(result.requestedDamage, 6);

  assert.equal(result.appliedDamage, 6);

  assert.equal(result.previousHp, 20);

  assert.equal(result.currentHp, 14);

  assert.equal(context.targetPokemon.currentHp, 14);

  console.log('✅ Normal battle damage applied');
}

function testOverkillClampsToZero(): void {
  const context = createExecutionContext();

  context.targetPokemon.currentHp = 3;

  const result = applyBattleMoveDamage(context, createDamageResult(10));

  assert.equal(result.requestedDamage, 10);

  assert.equal(result.appliedDamage, 3);

  assert.equal(result.previousHp, 3);

  assert.equal(result.currentHp, 0);

  assert.equal(context.targetPokemon.currentHp, 0);

  console.log('✅ Damage clamps target HP to zero');
}

function testZeroDamage(): void {
  const context = createExecutionContext();

  context.targetPokemon.currentHp = 20;

  const result = applyBattleMoveDamage(context, createDamageResult(0));

  assert.equal(result.appliedDamage, 0);

  assert.equal(result.previousHp, 20);

  assert.equal(result.currentHp, 20);

  assert.equal(context.targetPokemon.currentHp, 20);

  console.log('✅ Zero damage leaves HP unchanged');
}

function testCalculatedDamageCanBeApplied(): void {
  const context = createExecutionContext();

  const previousHp = context.targetPokemon.currentHp;

  const damage = calculateBattleMoveDamage(context);

  const result = applyBattleMoveDamage(context, damage);

  assert.ok(result.requestedDamage >= 1);

  assert.ok(result.currentHp <= previousHp);

  assert.ok(result.currentHp >= 0);

  console.log('✅ Calculated BattleMoveDamage applies correctly');

  console.log({
    previousHp: result.previousHp,

    damage: result.requestedDamage,

    appliedDamage: result.appliedDamage,

    currentHp: result.currentHp,
  });
}

function testInvalidDamageRejected(): void {
  const context = createExecutionContext();

  assert.throws(() => {
    applyBattleMoveDamage(context, createDamageResult(-1));
  }, /Invalid battle damage/);

  assert.equal(context.targetPokemon.currentHp >= 0, true);

  console.log('✅ Negative damage rejected');
}

function main(): void {
  testNormalDamage();

  testOverkillClampsToZero();

  testZeroDamage();

  testCalculatedDamageCanBeApplied();

  testInvalidDamageRejected();

  console.log('');

  console.log('============================================');

  console.log('✅ Pokemon BattleMoveDamageApplication smoke test passed');

  console.log('============================================');
}

main();
