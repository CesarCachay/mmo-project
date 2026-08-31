import assert from 'node:assert/strict';

import {
  addBattleTurnCommand,
  applyBattleMoveDamage,
  calculateBattleMoveDamage,
  consumeBattleMovePp,
  createBattleCommand,
  createBattleMoveExecutionContext,
  createBattleTurn,
  createBattleTurnResolutionOrder,
  createPokemonInstance,
  evaluateBattleMoveExecutionEligibility,
  getActiveBattlePokemon,
  resolveBattleMoveAccuracy,
  type BattleParticipant,
} from '@cesar-mmo/shared';

import { createWildBattleInstance } from '../pokemon/battles/pokemon-wild-battle.factory.js';

import type { PokemonWildEncounterSession } from '../pokemon/encounters/pokemon-wild-encounter-session.js';

const QUICK_ATTACK_MOVE_ID = 98;

const TACKLE_MOVE_ID = 33;

function getParticipant(
  participants: readonly BattleParticipant[],
  type: 'trainer' | 'wild',
): BattleParticipant {
  const participant = participants.find((candidate) => candidate.type === type);

  assert.ok(participant, `${type} participant must exist`);

  return participant;
}

function main(): void {
  const trainerPokemon = createPokemonInstance(19, 5);

  const wildPokemon = createPokemonInstance(19, 5);

  const encounterSession: PokemonWildEncounterSession = {
    encounterId: globalThis.crypto.randomUUID(),

    playerId: 'fainted-action-player',

    trainerId: 'fainted-action-trainer',

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

  const trainerBattlePokemon = getActiveBattlePokemon(trainer);

  const wildBattlePokemon = getActiveBattlePokemon(wild);

  //
  // Trainer uses priority +1
  // Quick Attack.
  //

  trainerBattlePokemon.pokemon.moves = [
    {
      moveId: QUICK_ATTACK_MOVE_ID,

      currentPp: 10,
    },
  ];

  //
  // Wild uses normal-priority
  // Tackle.
  //

  wildBattlePokemon.pokemon.moves = [
    {
      moveId: TACKLE_MOVE_ID,

      currentPp: 10,
    },
  ];

  //
  // Guarantee the Trainer can
  // faint Wild with any positive damage.
  //

  wildBattlePokemon.currentHp = 1;

  const trainerHpBefore = trainerBattlePokemon.currentHp;

  const trainerCommand = createBattleCommand(battle, {
    participantId: trainer.id,

    action: {
      type: 'use-move',

      moveId: QUICK_ATTACK_MOVE_ID,
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

  assert.equal(order.entries.length, 2);

  //
  // Quick Attack must act first
  // due to Move Priority.
  //

  assert.equal(order.entries[0]?.command.participantId, trainer.id);

  assert.equal(order.entries[1]?.command.participantId, wild.id);

  let skippedActions = 0;

  for (const entry of order.entries) {
    const eligibility = evaluateBattleMoveExecutionEligibility(battle, entry);

    if (!eligibility.canExecute) {
      skippedActions += 1;

      assert.equal(eligibility.skipReason, 'actor-fainted');

      continue;
    }

    const executionContext = createBattleMoveExecutionContext(battle, entry);

    consumeBattleMovePp(executionContext);

    const accuracy = resolveBattleMoveAccuracy(
      executionContext,

      // Deterministic HIT.
      () => 0,
    );

    assert.equal(accuracy.hit, true);

    const damage = calculateBattleMoveDamage(executionContext);

    applyBattleMoveDamage(executionContext, damage);
  }

  //
  // Trainer's attack fainted Wild.
  //

  assert.equal(wildBattlePokemon.currentHp, 0);

  //
  // Trainer actually executed,
  // therefore PP decreased.
  //

  assert.equal(trainerBattlePokemon.pokemon.moves[0]?.currentPp, 9);

  //
  // Wild was fainted BEFORE its
  // execution slot.
  //
  // Therefore its Tackle PP must
  // remain unchanged.
  //

  assert.equal(wildBattlePokemon.pokemon.moves[0]?.currentPp, 10);

  //
  // Wild never attacked Trainer.
  //

  assert.equal(trainerBattlePokemon.currentHp, trainerHpBefore);

  assert.equal(skippedActions, 1);

  console.log('✅ Fainted actor action skipped');

  console.log('✅ Skipped action consumes no PP');

  console.log('✅ Skipped action deals no damage');

  console.log('');

  console.log('============================================');

  console.log('✅ Pokemon FaintedActionCancellation smoke test passed');

  console.log('============================================');
}

main();
