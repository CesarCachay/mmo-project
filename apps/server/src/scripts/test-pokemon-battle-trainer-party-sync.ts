import assert from 'node:assert/strict';

import {
  createPokemonInstance,
  syncPokemonPartyFromBattleParticipant,
  type BattleParticipant,
  type PokemonParty,
} from '@cesar-mmo/shared';

import { createWildBattleInstance } from '../pokemon/battles/pokemon-wild-battle.factory.js';

import type { PokemonWildEncounterSession } from '../pokemon/encounters/pokemon-wild-encounter-session.js';

function getParticipant(
  participants: readonly BattleParticipant[],
  type: 'trainer' | 'wild',
): BattleParticipant {
  const participant = participants.find((candidate) => candidate.type === type);

  assert.ok(participant);

  return participant;
}

function main(): void {
  const trainerOne = createPokemonInstance(4, 5);

  const trainerTwo = createPokemonInstance(7, 5);

  const wildPokemon = createPokemonInstance(19, 5);

  const party: PokemonParty = {
    pokemon: [trainerOne, trainerTwo],
  };

  const originalHp = trainerOne.currentHp;

  const originalMove = trainerOne.moves[0];

  assert.ok(originalMove, 'Trainer Pokémon must have at least one move');

  const originalPp = originalMove.currentPp;

  const encounterSession: PokemonWildEncounterSession = {
    encounterId: globalThis.crypto.randomUUID(),

    playerId: 'battle-sync-player',

    trainerId: 'battle-sync-trainer',

    mapId: 'route-01',

    zoneId: 'route-grass-zone-01',

    encounterTableId: 'town-grass',

    pokemon: wildPokemon,

    status: 'active',
  };

  const battle = createWildBattleInstance({
    encounterSession,

    trainerPokemon: party.pokemon,
  });

  const trainer = getParticipant(battle.participants, 'trainer');

  const wild = getParticipant(battle.participants, 'wild');

  const battlePokemon = trainer.pokemon[0];

  assert.ok(battlePokemon);

  const battleMove = battlePokemon.pokemon.moves[0];

  assert.ok(battleMove);

  //
  // Simulate Battle mutations.
  //

  battlePokemon.currentHp = Math.max(0, originalHp - 3);

  battleMove.currentPp = Math.max(0, originalPp - 1);

  const updatedParty = syncPokemonPartyFromBattleParticipant(party, trainer);

  const updatedPokemon = updatedParty.pokemon[0];

  assert.ok(updatedPokemon);

  assert.equal(updatedPokemon.currentHp, battlePokemon.currentHp);

  assert.equal(updatedPokemon.moves[0]?.currentPp, battleMove.currentPp);

  //
  // Original persistent Party object
  // must remain unchanged.
  //

  assert.equal(trainerOne.currentHp, originalHp);

  assert.equal(trainerOne.moves[0]?.currentPp, originalPp);

  assert.notEqual(updatedParty, party);

  assert.notEqual(updatedPokemon, trainerOne);

  console.log('✅ Battle HP synchronized into new Party');

  console.log('✅ Battle PP synchronized into new Party');

  console.log('✅ Original Party remains immutable');

  //
  // Wild participant must never be allowed
  // to overwrite Trainer Party.
  //

  assert.throws(() => {
    syncPokemonPartyFromBattleParticipant(party, wild);
  }, /non-Trainer participant/);

  console.log('✅ Wild participant Party sync rejected');

  console.log('');

  console.log('============================================');

  console.log('✅ Pokemon BattleTrainerPartySync smoke test passed');

  console.log('============================================');
}

main();
