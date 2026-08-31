import assert from 'node:assert/strict';

import {
  addBattleTurnCommand,
  createBattleCommand,
  createBattleTurn,
  createBattleTurnResolutionOrder,
  createPokemonInstance,
  getActiveBattlePokemon,
  getPokemonMove,
  isBattleTurnReady,
  type BattleParticipant,
  type BattleTurn,
} from '@cesar-mmo/shared';

import { createWildBattleInstance } from '../pokemon/battles/pokemon-wild-battle.factory.js';

import type { PokemonWildEncounterSession } from '../pokemon/encounters/pokemon-wild-encounter-session.js';

const TACKLE_MOVE_ID = 33;
const QUICK_ATTACK_MOVE_ID = 98;

function getParticipant(
  participants: readonly BattleParticipant[],
  type: 'trainer' | 'wild',
): BattleParticipant {
  const participant = participants.find((candidate) => candidate.type === type);

  assert.ok(participant, `${type} participant must exist`);

  return participant;
}

function createTestBattle(
  trainerSpeciesId: number,
  wildSpeciesId: number,
  level = 5,
) {
  const trainerPokemon = createPokemonInstance(trainerSpeciesId, level);

  const wildPokemon = createPokemonInstance(wildSpeciesId, level);

  const encounterSession: PokemonWildEncounterSession = {
    encounterId: globalThis.crypto.randomUUID(),

    playerId: globalThis.crypto.randomUUID(),

    trainerId: globalThis.crypto.randomUUID(),

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

function setActivePokemonMove(
  participant: BattleParticipant,
  moveId: number,
): void {
  const activePokemon = getActiveBattlePokemon(participant);

  activePokemon.pokemon.moves = [
    {
      moveId,
      currentPp: 10,
    },
  ];
}

function createCommand(
  battle: ReturnType<typeof createTestBattle>['battle'],

  participant: BattleParticipant,

  moveId: number,
) {
  return createBattleCommand(battle, {
    participantId: participant.id,

    action: {
      type: 'use-move',

      moveId,
    },
  });
}

function createReadyTurn(
  context: ReturnType<typeof createTestBattle>,

  trainerMoveId: number,
  wildMoveId: number,
): BattleTurn {
  setActivePokemonMove(context.trainerParticipant, trainerMoveId);

  setActivePokemonMove(context.wildParticipant, wildMoveId);

  const trainerCommand = createCommand(
    context.battle,
    context.trainerParticipant,
    trainerMoveId,
  );

  const wildCommand = createCommand(
    context.battle,
    context.wildParticipant,
    wildMoveId,
  );

  let turn = createBattleTurn(context.battle, 1);

  turn = addBattleTurnCommand(context.battle, turn, trainerCommand);

  turn = addBattleTurnCommand(context.battle, turn, wildCommand);

  assert.equal(isBattleTurnReady(context.battle, turn), true);

  return turn;
}

function testMovePriority(): void {
  //
  // Same species + same level ensures
  // equal Speed.
  //
  // Quick Attack should therefore beat
  // Tackle because of Move Priority.
  //

  const context = createTestBattle(19, 19, 5);

  const quickAttack = getPokemonMove(QUICK_ATTACK_MOVE_ID);

  const tackle = getPokemonMove(TACKLE_MOVE_ID);

  assert.ok(quickAttack, 'Quick Attack must exist');

  assert.ok(tackle, 'Tackle must exist');

  assert.ok(
    quickAttack.priority > tackle.priority,
    'Quick Attack must have higher priority than Tackle',
  );

  const turn = createReadyTurn(context, QUICK_ATTACK_MOVE_ID, TACKLE_MOVE_ID);

  const order = createBattleTurnResolutionOrder(
    context.battle,
    turn,
    () => 0.5,
  );

  assert.equal(order.entries.length, 2);

  assert.equal(
    order.entries[0]?.command.participantId,
    context.trainerParticipant.id,
  );

  assert.equal(order.entries[0]?.command.action.type, 'use-move');

  if (order.entries[0]?.command.action.type === 'use-move') {
    assert.equal(order.entries[0].command.action.moveId, QUICK_ATTACK_MOVE_ID);
  }

  console.log('✅ Higher Move Priority acts first');
}

function testSpeed(): void {
  //
  // Both use Tackle.
  //
  // Therefore Priority is identical.
  // Resolution must use Speed.
  //

  const context = createTestBattle(4, 19, 5);

  const turn = createReadyTurn(context, TACKLE_MOVE_ID, TACKLE_MOVE_ID);

  const order = createBattleTurnResolutionOrder(
    context.battle,
    turn,
    () => 0.5,
  );

  const first = order.entries[0];

  const second = order.entries[1];

  assert.ok(first);
  assert.ok(second);

  assert.equal(first.movePriority, second.movePriority);

  assert.ok(
    first.speed > second.speed,
    'Higher Speed must act first when Move Priority is equal',
  );

  console.log('✅ Higher Speed acts first when Priority is equal');
}

function testRandomTieBreaker(): void {
  //
  // Same species
  // Same level
  // Same move
  //
  // → identical Priority + Speed.
  //

  const context = createTestBattle(19, 19, 5);

  const turn = createReadyTurn(context, TACKLE_MOVE_ID, TACKLE_MOVE_ID);

  const randomValues = [
    0.2, // Trainer
    0.8, // Wild
  ];

  const order = createBattleTurnResolutionOrder(context.battle, turn, () => {
    const value = randomValues.shift();

    assert.notEqual(value, undefined, 'Unexpected RNG call');

    return value!;
  });

  const first = order.entries[0];

  const second = order.entries[1];

  assert.ok(first);
  assert.ok(second);

  assert.equal(first.movePriority, second.movePriority);

  assert.equal(first.speed, second.speed);

  //
  // Comparator currently uses the
  // higher tieBreaker first.
  //

  assert.equal(first.tieBreaker, 0.8);

  assert.equal(first.command.participantId, context.wildParticipant.id);

  assert.equal(second.tieBreaker, 0.2);

  assert.equal(second.command.participantId, context.trainerParticipant.id);

  console.log('✅ RNG resolves exact Priority + Speed tie');
}

function testNotReadyTurn(): void {
  const context = createTestBattle(19, 19, 5);

  setActivePokemonMove(context.trainerParticipant, TACKLE_MOVE_ID);

  const trainerCommand = createCommand(
    context.battle,
    context.trainerParticipant,
    TACKLE_MOVE_ID,
  );

  let turn = createBattleTurn(context.battle, 1);

  turn = addBattleTurnCommand(context.battle, turn, trainerCommand);

  assert.equal(isBattleTurnReady(context.battle, turn), false);

  assert.throws(() => {
    createBattleTurnResolutionOrder(context.battle, turn, () => 0.5);
  }, /is not ready/);

  console.log('✅ Incomplete Turn rejected');
}

function main(): void {
  testMovePriority();

  testSpeed();

  testRandomTieBreaker();

  testNotReadyTurn();

  console.log('');

  console.log('============================================');

  console.log('✅ Pokemon BattleTurnResolutionOrder smoke test passed');

  console.log('============================================');
}

main();
