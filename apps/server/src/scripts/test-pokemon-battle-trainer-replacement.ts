import assert from 'node:assert/strict';

import {
  createBattleCommand,
  createPokemonInstance,
  getActiveBattlePokemon,
  isBattleTurnReady,
  replaceFaintedTrainerBattlePokemon,
  resolveWildBattleContinuationOutcome,
  type BattleParticipant,
} from '@cesar-mmo/shared';

import { createWildBattleInstance } from '../pokemon/battles/pokemon-wild-battle.factory.js';

import { PokemonBattleTurnStore } from '../pokemon/battles/pokemon-battle-turn.store.js';

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
  const trainerPokemonOne = createPokemonInstance(4, 5);

  const trainerPokemonTwo = createPokemonInstance(7, 5);

  const wildPokemon = createPokemonInstance(19, 5);

  const encounterSession: PokemonWildEncounterSession = {
    encounterId: globalThis.crypto.randomUUID(),

    playerId: 'replacement-player',

    trainerId: 'replacement-trainer',

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

  const trainer = getParticipant(battle.participants, 'trainer');

  const wild = getParticipant(battle.participants, 'wild');

  //
  // Make command setup deterministic.
  //

  for (const pokemon of trainer.pokemon) {
    pokemon.pokemon.moves = [
      {
        moveId: TACKLE_MOVE_ID,

        currentPp: 10,
      },
    ];
  }

  getActiveBattlePokemon(wild).pokemon.moves = [
    {
      moveId: TACKLE_MOVE_ID,

      currentPp: 10,
    },
  ];

  return {
    battle,
    trainer,
    wild,
  };
}

function testValidReplacement(): void {
  const { trainer } = createTestBattle();

  assert.equal(trainer.activePokemonIndex, 0);

  const faintedPokemon = trainer.pokemon[0];

  const reservePokemon = trainer.pokemon[1];

  assert.ok(faintedPokemon);

  assert.ok(reservePokemon);

  faintedPokemon.currentHp = 0;

  const reserveHpBefore = reservePokemon.currentHp;

  const result = replaceFaintedTrainerBattlePokemon(trainer, 1);

  assert.equal(result.previousActivePokemonIndex, 0);

  assert.equal(result.currentActivePokemonIndex, 1);

  assert.equal(trainer.activePokemonIndex, 1);

  assert.equal(result.activePokemon, reservePokemon);

  assert.equal(reservePokemon.currentHp, reserveHpBefore);

  assert.equal(getActiveBattlePokemon(trainer), reservePokemon);

  console.log('✅ Fainted Trainer Pokémon replaced');

  console.log('✅ Replacement preserves reserve Pokémon state');
}

function testHealthyActiveCannotBeReplaced(): void {
  const { trainer } = createTestBattle();

  assert.ok(getActiveBattlePokemon(trainer).currentHp > 0);

  assert.throws(() => {
    replaceFaintedTrainerBattlePokemon(trainer, 1);
  }, /still able to battle/);

  assert.equal(trainer.activePokemonIndex, 0);

  console.log('✅ Healthy active Pokémon cannot use faint replacement');
}

function testSameIndexRejected(): void {
  const { trainer } = createTestBattle();

  const active = getActiveBattlePokemon(trainer);

  active.currentHp = 0;

  assert.throws(() => {
    replaceFaintedTrainerBattlePokemon(trainer, 0);
  }, /already active/);

  console.log('✅ Current active index cannot be selected as replacement');
}

function testFaintedReplacementRejected(): void {
  const { trainer } = createTestBattle();

  const active = trainer.pokemon[0];

  const reserve = trainer.pokemon[1];

  assert.ok(active);
  assert.ok(reserve);

  active.currentHp = 0;

  reserve.currentHp = 0;

  assert.throws(() => {
    replaceFaintedTrainerBattlePokemon(trainer, 1);
  }, /is fainted/);

  assert.equal(trainer.activePokemonIndex, 0);

  console.log('✅ Fainted reserve Pokémon rejected');
}

function testInvalidIndexRejected(): void {
  const { trainer } = createTestBattle();

  getActiveBattlePokemon(trainer).currentHp = 0;

  assert.throws(() => {
    replaceFaintedTrainerBattlePokemon(trainer, 99);
  }, /does not exist/);

  assert.throws(() => {
    replaceFaintedTrainerBattlePokemon(trainer, -1);
  }, /Invalid replacement Pokémon index/);

  console.log('✅ Invalid replacement indexes rejected');
}

function testWildCannotUseTrainerReplacement(): void {
  const { wild } = createTestBattle();

  getActiveBattlePokemon(wild).currentHp = 0;

  assert.throws(() => {
    replaceFaintedTrainerBattlePokemon(wild, 1);
  }, /is not a Trainer/);

  console.log('✅ Wild participant cannot use Trainer replacement');
}

function testReplacementResumesTurnLifecycle(): void {
  const { battle, trainer, wild } = createTestBattle();

  const turnStore = new PokemonBattleTurnStore();

  //
  // Prepare a completed/ready Turn 1.
  //

  turnStore.create(battle);

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

  turnStore.submitCommand(battle, trainerCommand);

  turnStore.submitCommand(battle, wildCommand);

  const resolvedTurn = turnStore.getByBattleId(battle.battleId);

  assert.ok(resolvedTurn);

  assert.equal(isBattleTurnReady(battle, resolvedTurn), true);

  //
  // Simulate result of Turn 1:
  // Trainer active Pokémon fainted,
  // reserve survives.
  //

  const firstTrainerPokemon = trainer.pokemon[0];

  const secondTrainerPokemon = trainer.pokemon[1];

  assert.ok(firstTrainerPokemon);

  assert.ok(secondTrainerPokemon);

  firstTrainerPokemon.currentHp = 0;

  assert.ok(secondTrainerPokemon.currentHp > 0);

  //
  // Before replacement, Battle must pause.
  //

  const beforeReplacement = resolveWildBattleContinuationOutcome(battle);

  assert.equal(beforeReplacement.type, 'trainer-replacement-required');

  //
  // Authoritative replacement.
  //

  replaceFaintedTrainerBattlePokemon(trainer, 1);

  //
  // Once replacement is valid,
  // the Battle can continue again.
  //

  const afterReplacement = resolveWildBattleContinuationOutcome(battle);

  assert.deepEqual(afterReplacement, {
    type: 'continue',
  });

  //
  // Existing resolved Turn can now
  // advance to Turn 2.
  //

  const turn2 = turnStore.advance(battle);

  assert.equal(turn2.number, 2);

  assert.equal(turn2.commands.length, 0);

  assert.equal(trainer.activePokemonIndex, 1);

  assert.equal(getActiveBattlePokemon(trainer), secondTrainerPokemon);

  console.log('✅ Replacement changes continuation back to continue');

  console.log('✅ Replacement resumes Turn N → Turn N+1 lifecycle');
}

function main(): void {
  testValidReplacement();

  testHealthyActiveCannotBeReplaced();

  testSameIndexRejected();

  testFaintedReplacementRejected();

  testInvalidIndexRejected();

  testWildCannotUseTrainerReplacement();

  testReplacementResumesTurnLifecycle();

  console.log('');

  console.log('============================================');

  console.log('✅ Pokemon BattleTrainerReplacement smoke test passed');

  console.log('============================================');
}

main();
