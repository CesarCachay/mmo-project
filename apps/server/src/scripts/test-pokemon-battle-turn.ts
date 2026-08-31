import assert from 'node:assert/strict';

import {
  addBattleTurnCommand,
  completeBattle,
  createBattleCommand,
  createBattleTurn,
  createPokemonInstance,
  getActiveBattlePokemon,
  hasBattleTurnCommand,
  isBattleTurnReady,
  type BattleParticipant,
} from '@cesar-mmo/shared';

import { createWildBattleInstance } from '../pokemon/battles/pokemon-wild-battle.factory';

import type { PokemonWildEncounterSession } from '../pokemon/encounters/pokemon-wild-encounter-session';

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

  const wildPokemon = createPokemonInstance(19, 3);

  const encounterSession: PokemonWildEncounterSession = {
    encounterId: globalThis.crypto.randomUUID(),

    playerId: `test-player-${suffix}`,

    trainerId: `test-trainer-${suffix}`,

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

function createUseMoveCommand(
  battleContext: ReturnType<typeof createTestBattle>,
  participant: BattleParticipant,
) {
  const activePokemon = getActiveBattlePokemon(participant);

  const move = activePokemon.pokemon.moves[0];

  assert.ok(
    move,
    `Participant "${participant.id}" active Pokémon must know at least one move`,
  );

  return createBattleCommand(battleContext.battle, {
    participantId: participant.id,

    action: {
      type: 'use-move',

      moveId: move.moveId,
    },
  });
}

function main(): void {
  const context = createTestBattle('01');

  //
  // 1. Create Turn 1
  //

  let turn = createBattleTurn(context.battle, 1);

  assert.equal(turn.battleId, context.battle.battleId);

  assert.equal(turn.number, 1);

  assert.equal(turn.commands.length, 0);

  assert.equal(isBattleTurnReady(context.battle, turn), false);

  //
  // 2. Trainer command
  //

  const trainerCommand = createUseMoveCommand(
    context,
    context.trainerParticipant,
  );

  turn = addBattleTurnCommand(context.battle, turn, trainerCommand);

  assert.equal(turn.commands.length, 1);

  assert.equal(hasBattleTurnCommand(turn, context.trainerParticipant.id), true);

  assert.equal(hasBattleTurnCommand(turn, context.wildParticipant.id), false);

  assert.equal(isBattleTurnReady(context.battle, turn), false);

  //
  // 3. Duplicate Trainer command
  //

  assert.throws(() => {
    addBattleTurnCommand(context.battle, turn, trainerCommand);
  }, /already submitted a command/);

  //
  // 4. Wild command
  //

  const wildCommand = createUseMoveCommand(context, context.wildParticipant);

  turn = addBattleTurnCommand(context.battle, turn, wildCommand);

  assert.equal(turn.commands.length, 2);

  assert.equal(hasBattleTurnCommand(turn, context.wildParticipant.id), true);

  assert.equal(isBattleTurnReady(context.battle, turn), true);

  //
  // 5. Command from another Battle
  //

  const otherContext = createTestBattle('02');

  const otherTrainerCommand = createUseMoveCommand(
    otherContext,
    otherContext.trainerParticipant,
  );

  assert.throws(() => {
    addBattleTurnCommand(context.battle, turn, otherTrainerCommand);
  }, /does not match battle/);

  //
  // 6. Turn from another Battle
  //

  const otherTurn = createBattleTurn(otherContext.battle, 1);

  assert.throws(() => {
    isBattleTurnReady(context.battle, otherTurn);
  }, /does not belong to battle/);

  //
  // 7. Completed Battle cannot create new Turn
  //

  const completedContext = createTestBattle('03');

  const completedBattle = completeBattle(completedContext.battle);

  assert.throws(() => {
    createBattleTurn(completedBattle, 1);
  }, /Cannot create turn/);

  //
  // 8. Completed Battle cannot receive commands
  //

  const activeTurn = createBattleTurn(completedContext.battle, 1);

  const completedTrainerCommand = createUseMoveCommand(
    completedContext,
    completedContext.trainerParticipant,
  );

  assert.throws(() => {
    addBattleTurnCommand(completedBattle, activeTurn, completedTrainerCommand);
  }, /is not active/);

  console.log('✅ Pokemon BattleTurn smoke test passed');

  console.log({
    battleId: context.battle.battleId,

    turn: turn.number,

    commands: turn.commands.length,

    trainerReady: hasBattleTurnCommand(turn, context.trainerParticipant.id),

    wildReady: hasBattleTurnCommand(turn, context.wildParticipant.id),

    turnReady: isBattleTurnReady(context.battle, turn),
  });
}

main();
