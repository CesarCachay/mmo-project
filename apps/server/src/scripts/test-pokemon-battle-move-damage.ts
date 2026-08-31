import assert from 'node:assert/strict';

import {
  addBattleTurnCommand,
  calculateBattleMoveDamage,
  createBattleCommand,
  createBattleMoveExecutionContext,
  createBattleTurn,
  createBattleTurnResolutionOrder,
  createPokemonInstance,
  getActiveBattlePokemon,
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

  assert.ok(participant);

  return participant;
}

function createExecutionContext(): BattleMoveExecutionContext {
  const trainerPokemon = createPokemonInstance(4, 5);

  const wildPokemon = createPokemonInstance(19, 5);

  const encounterSession: PokemonWildEncounterSession = {
    encounterId: globalThis.crypto.randomUUID(),

    playerId: 'damage-player',

    trainerId: 'damage-trainer',

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

  assert.ok(trainerEntry);

  return createBattleMoveExecutionContext(battle, trainerEntry);
}

function testPhysicalDamage(): void {
  const context = createExecutionContext();

  assert.equal(context.move.damageClass, 'physical');

  const result = calculateBattleMoveDamage(context);

  assert.ok(result.damage >= 1);

  assert.equal(result.damageClass, 'physical');

  assert.ok(result.attack !== null);

  assert.ok(result.defense !== null);

  assert.ok(result.power !== null);

  console.log('✅ Physical move damage calculated');

  console.log({
    move: context.move.name,

    level: context.actorPokemon.pokemon.level,

    power: result.power,

    attack: result.attack,

    defense: result.defense,

    damage: result.damage,
  });
}

function testStatusMove(): void {
  const base = createExecutionContext();

  const context: BattleMoveExecutionContext = {
    ...base,

    move: {
      ...base.move,

      damageClass: 'status',

      power: null,
    },
  };

  const result = calculateBattleMoveDamage(context);

  assert.equal(result.damage, 0);

  assert.equal(result.damageClass, 'status');

  assert.equal(result.attack, null);

  assert.equal(result.defense, null);

  console.log('✅ Status move produces zero direct damage');
}

function testNoPowerMove(): void {
  const base = createExecutionContext();

  const context: BattleMoveExecutionContext = {
    ...base,

    move: {
      ...base.move,

      power: null,
    },
  };

  const result = calculateBattleMoveDamage(context);

  assert.equal(result.damage, 0);

  assert.equal(result.power, null);

  console.log('✅ Move without normal Power produces zero foundation damage');
}

function main(): void {
  testPhysicalDamage();

  testStatusMove();

  testNoPowerMove();

  console.log('');

  console.log('============================================');

  console.log('✅ Pokemon BattleMoveDamage smoke test passed');

  console.log('============================================');
}

main();
