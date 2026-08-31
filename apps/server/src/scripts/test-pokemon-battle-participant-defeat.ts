import assert from 'node:assert/strict';

import {
  createPokemonInstance,
  getBattleParticipantReplacementPokemonIndexes,
  getBattleParticipantUsablePokemonIndexes,
  hasBattleParticipantUsablePokemon,
  isBattleParticipantDefeated,
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

function createTestBattle() {
  const trainerPokemonOne = createPokemonInstance(4, 5);

  const trainerPokemonTwo = createPokemonInstance(7, 5);

  const wildPokemon = createPokemonInstance(19, 5);

  const encounterSession: PokemonWildEncounterSession = {
    encounterId: globalThis.crypto.randomUUID(),

    playerId: 'participant-defeat-player',

    trainerId: 'participant-defeat-trainer',

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

  return {
    battle,
    trainer,
    wild,
  };
}

function testHealthyTrainerRoster(): void {
  const { trainer } = createTestBattle();

  assert.equal(trainer.activePokemonIndex, 0);

  const usable = getBattleParticipantUsablePokemonIndexes(trainer);

  assert.deepEqual(usable, [0, 1]);

  const replacements = getBattleParticipantReplacementPokemonIndexes(trainer);

  assert.deepEqual(replacements, [1]);

  assert.equal(hasBattleParticipantUsablePokemon(trainer), true);

  assert.equal(isBattleParticipantDefeated(trainer), false);

  console.log('✅ Healthy Trainer roster has usable Pokémon');
}

function testFaintedActiveWithReplacement(): void {
  const { trainer } = createTestBattle();

  const activePokemon = trainer.pokemon[trainer.activePokemonIndex];

  assert.ok(activePokemon);

  activePokemon.currentHp = 0;

  const usable = getBattleParticipantUsablePokemonIndexes(trainer);

  assert.deepEqual(usable, [1]);

  const replacements = getBattleParticipantReplacementPokemonIndexes(trainer);

  assert.deepEqual(replacements, [1]);

  assert.equal(hasBattleParticipantUsablePokemon(trainer), true);

  assert.equal(isBattleParticipantDefeated(trainer), false);

  console.log(
    '✅ Fainted active Pokémon does not defeat Trainer when replacement exists',
  );
}

function testTrainerAllPokemonFainted(): void {
  const { trainer } = createTestBattle();

  for (const pokemon of trainer.pokemon) {
    pokemon.currentHp = 0;
  }

  assert.deepEqual(getBattleParticipantUsablePokemonIndexes(trainer), []);

  assert.deepEqual(getBattleParticipantReplacementPokemonIndexes(trainer), []);

  assert.equal(hasBattleParticipantUsablePokemon(trainer), false);

  assert.equal(isBattleParticipantDefeated(trainer), true);

  console.log('✅ Trainer defeated when all Pokémon are fainted');
}

function testWildParticipantDefeat(): void {
  const { wild } = createTestBattle();

  assert.equal(wild.pokemon.length, 1);

  assert.equal(isBattleParticipantDefeated(wild), false);

  const wildPokemon = wild.pokemon[0];

  assert.ok(wildPokemon);

  wildPokemon.currentHp = 0;

  assert.deepEqual(getBattleParticipantUsablePokemonIndexes(wild), []);

  assert.deepEqual(getBattleParticipantReplacementPokemonIndexes(wild), []);

  assert.equal(isBattleParticipantDefeated(wild), true);

  console.log('✅ Wild participant defeated when its only Pokémon faints');
}

function testInvalidPokemonHpStillRejected(): void {
  const { trainer } = createTestBattle();

  const pokemon = trainer.pokemon[0];

  assert.ok(pokemon);

  pokemon.currentHp = -1;

  assert.throws(() => {
    isBattleParticipantDefeated(trainer);
  }, /Invalid battle Pokémon HP/);

  console.log('✅ Invalid roster HP rejected');
}

function main(): void {
  testHealthyTrainerRoster();

  testFaintedActiveWithReplacement();

  testTrainerAllPokemonFainted();

  testWildParticipantDefeat();

  testInvalidPokemonHpStillRejected();

  console.log('');

  console.log('============================================');

  console.log('✅ Pokemon BattleParticipantDefeat smoke test passed');

  console.log('============================================');
}

main();
