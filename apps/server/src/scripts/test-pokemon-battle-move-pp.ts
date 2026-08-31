import assert from 'node:assert/strict';

import {
  addBattleTurnCommand,
  consumeBattleMovePp,
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

  assert.ok(participant, `${type} participant must exist`);

  return participant;
}

function createTestBattle() {
  const trainerPokemon = createPokemonInstance(4, 5);

  const wildPokemon = createPokemonInstance(19, 5);

  const encounterSession: PokemonWildEncounterSession = {
    encounterId: globalThis.crypto.randomUUID(),

    playerId: 'pp-player',

    trainerId: 'pp-trainer',

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

  return {
    battle,

    trainerParticipant: getParticipant(battle.participants, 'trainer'),

    wildParticipant: getParticipant(battle.participants, 'wild'),
  };
}

function setMove(participant: BattleParticipant, currentPp: number): void {
  const pokemon = getActiveBattlePokemon(participant);

  pokemon.pokemon.moves = [
    {
      moveId: TACKLE_MOVE_ID,

      currentPp,
    },
  ];
}

function createExecutionContext(initialPp = 10): BattleMoveExecutionContext {
  const context = createTestBattle();

  setMove(context.trainerParticipant, initialPp);

  setMove(context.wildParticipant, 10);

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

  const order = createBattleTurnResolutionOrder(
    context.battle,
    turn,
    () => 0.5,
  );

  const trainerEntry = order.entries.find(
    (entry) => entry.command.participantId === context.trainerParticipant.id,
  );

  assert.ok(trainerEntry, 'Trainer resolution entry must exist');

  return createBattleMoveExecutionContext(context.battle, trainerEntry);
}

function testConsumeOnePp(): void {
  const context = createExecutionContext(10);

  const result = consumeBattleMovePp(context);

  assert.equal(result.moveId, TACKLE_MOVE_ID);

  assert.equal(result.previousPp, 10);

  assert.equal(result.currentPp, 9);

  assert.equal(context.selectedMove.currentPp, 9);

  console.log('✅ Move PP consumed');
}

function testLastPpCanBeConsumed(): void {
  const context = createExecutionContext(1);

  const result = consumeBattleMovePp(context);

  assert.equal(result.previousPp, 1);

  assert.equal(result.currentPp, 0);

  assert.equal(context.selectedMove.currentPp, 0);

  console.log('✅ Last PP can be consumed to zero');
}

function testCannotConsumeAtZero(): void {
  const context = createExecutionContext(1);

  consumeBattleMovePp(context);

  assert.equal(context.selectedMove.currentPp, 0);

  assert.throws(() => {
    consumeBattleMovePp(context);
  }, /Cannot consume PP/);

  assert.equal(context.selectedMove.currentPp, 0);

  console.log('✅ PP cannot go below zero');
}

function testOnlySelectedMoveChanges(): void {
  const context = createExecutionContext(10);

  const pokemon = context.actorPokemon.pokemon;

  pokemon.moves.push({
    moveId: 45,
    currentPp: 40,
  });

  const otherMove = pokemon.moves.find((move) => move.moveId === 45);

  assert.ok(otherMove);

  consumeBattleMovePp(context);

  assert.equal(context.selectedMove.currentPp, 9);

  assert.equal(otherMove.currentPp, 40);

  console.log('✅ Only selected move PP changes');
}

function main(): void {
  testConsumeOnePp();

  testLastPpCanBeConsumed();

  testCannotConsumeAtZero();

  testOnlySelectedMoveChanges();

  console.log('');

  console.log('============================================');

  console.log('✅ Pokemon BattleMovePP smoke test passed');

  console.log('============================================');
}

main();
