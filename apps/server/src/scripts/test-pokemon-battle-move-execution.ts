import assert from 'node:assert/strict';

import {
  addBattleTurnCommand,
  completeBattle,
  createBattleCommand,
  createBattleMoveExecutionContext,
  createBattleTurn,
  createBattleTurnResolutionOrder,
  createPokemonInstance,
  getActiveBattlePokemon,
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

function createTestBattle(suffix: string) {
  const trainerPokemon = createPokemonInstance(4, 5);

  const wildPokemon = createPokemonInstance(19, 5);

  const encounterSession: PokemonWildEncounterSession = {
    encounterId: globalThis.crypto.randomUUID(),

    playerId: `move-execution-player-${suffix}`,

    trainerId: `move-execution-trainer-${suffix}`,

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

function createReadyResolutionOrder(
  context: ReturnType<typeof createTestBattle>,
) {
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

  return createBattleTurnResolutionOrder(context.battle, turn, () => 0.5);
}

function testValidContext(): void {
  const context = createTestBattle('valid');

  const resolutionOrder = createReadyResolutionOrder(context);

  const entry = resolutionOrder.entries[0];

  assert.ok(entry, 'Resolution order must contain an entry');

  const executionContext = createBattleMoveExecutionContext(
    context.battle,
    entry,
  );

  assert.equal(executionContext.battleId, context.battle.battleId);

  assert.equal(
    executionContext.actorParticipantId,
    entry.command.participantId,
  );

  assert.notEqual(
    executionContext.actorParticipantId,
    executionContext.targetParticipantId,
  );

  const actorParticipant = context.battle.participants.find(
    (participant) => participant.id === executionContext.actorParticipantId,
  );

  const targetParticipant = context.battle.participants.find(
    (participant) => participant.id === executionContext.targetParticipantId,
  );

  assert.ok(actorParticipant);
  assert.ok(targetParticipant);

  assert.notEqual(actorParticipant.side, targetParticipant.side);

  assert.equal(executionContext.selectedMove.moveId, TACKLE_MOVE_ID);

  assert.equal(executionContext.selectedMove.currentPp, 10);

  assert.equal(executionContext.move.id, TACKLE_MOVE_ID);

  assert.equal(executionContext.move.name, 'tackle');

  assert.equal(
    executionContext.actorPokemon,
    getActiveBattlePokemon(actorParticipant),
  );

  assert.equal(
    executionContext.targetPokemon,
    getActiveBattlePokemon(targetParticipant),
  );

  console.log('✅ Valid MoveExecutionContext resolved');
}

function testExecutionTimePpValidation(): void {
  const context = createTestBattle('pp');

  const resolutionOrder = createReadyResolutionOrder(context);

  const entry = resolutionOrder.entries[0];

  assert.ok(entry);

  const actorParticipant = context.battle.participants.find(
    (participant) => participant.id === entry.command.participantId,
  );

  assert.ok(actorParticipant);

  const actorPokemon = getActiveBattlePokemon(actorParticipant);

  const selectedMove = actorPokemon.pokemon.moves.find(
    (move) => move.moveId === TACKLE_MOVE_ID,
  );

  assert.ok(selectedMove);

  //
  // Command and Turn were already accepted,
  // but runtime state changes before execution.
  //

  selectedMove.currentPp = 0;

  assert.throws(() => {
    createBattleMoveExecutionContext(context.battle, entry);
  }, /has no PP remaining at execution time/);

  console.log('✅ Execution-time PP validation works');
}

function testWrongBattle(): void {
  const firstContext = createTestBattle('battle-a');

  const secondContext = createTestBattle('battle-b');

  const resolutionOrder = createReadyResolutionOrder(firstContext);

  const entry = resolutionOrder.entries[0];

  assert.ok(entry);

  assert.throws(() => {
    createBattleMoveExecutionContext(secondContext.battle, entry);
  }, /does not belong to battle/);

  console.log('✅ Command from another Battle rejected');
}

function testCompletedBattle(): void {
  const context = createTestBattle('completed');

  const resolutionOrder = createReadyResolutionOrder(context);

  const entry = resolutionOrder.entries[0];

  assert.ok(entry);

  const completedBattle = completeBattle(context.battle);

  assert.throws(() => {
    createBattleMoveExecutionContext(completedBattle, entry);
  }, /Cannot create move execution context/);

  console.log('✅ Completed Battle rejected');
}

function main(): void {
  testValidContext();

  testExecutionTimePpValidation();

  testWrongBattle();

  testCompletedBattle();

  console.log('');

  console.log('============================================');

  console.log('✅ Pokemon BattleMoveExecutionContext smoke test passed');

  console.log('============================================');
}

main();
