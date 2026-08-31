import assert from 'node:assert/strict';

import {
  createPokemonInstance,
  getActiveBattlePokemon,
} from '@cesar-mmo/shared';

import { createWildBattleInstance } from '../pokemon/battles/pokemon-wild-battle.factory';
import type { PokemonWildEncounterSession } from '../pokemon/encounters/pokemon-wild-encounter-session';

function main(): void {
  const trainerCharmander = createPokemonInstance(4, 5);

  const trainerPidgey = createPokemonInstance(16, 4);

  const wildRattata = createPokemonInstance(19, 3);

  const encounterSession: PokemonWildEncounterSession = {
    encounterId: globalThis.crypto.randomUUID(),

    playerId: 'test-player-01',

    trainerId: 'test-trainer-01',

    mapId: 'route-01',

    zoneId: 'route-grass-zone-01',

    encounterTableId: 'town-grass',

    pokemon: wildRattata,

    status: 'active',
  };

  const battle = createWildBattleInstance({
    encounterSession,

    trainerPokemon: [trainerCharmander, trainerPidgey],
  });

  //
  // Battle identity
  //

  assert.ok(battle.battleId.length > 0, 'Battle must have an id');

  assert.equal(battle.type, 'wild');

  assert.equal(battle.status, 'active');

  //
  // Participants
  //

  assert.equal(
    battle.participants.length,
    2,
    'Wild battle must contain exactly two participants',
  );

  const trainerParticipant = battle.participants.find(
    (participant) => participant.type === 'trainer',
  );

  const wildParticipant = battle.participants.find(
    (participant) => participant.type === 'wild',
  );

  assert.ok(trainerParticipant, 'Trainer participant must exist');

  assert.ok(wildParticipant, 'Wild participant must exist');

  assert.equal(trainerParticipant.side, 'side-a');

  assert.equal(wildParticipant.side, 'side-b');

  //
  // Trainer party snapshot
  //

  assert.equal(trainerParticipant.pokemon.length, 2);

  assert.equal(trainerParticipant.activePokemonIndex, 0);

  const activeTrainerPokemon = getActiveBattlePokemon(trainerParticipant);

  assert.equal(
    activeTrainerPokemon.pokemon.instanceId,
    trainerCharmander.instanceId,
  );

  //
  // Wild Pokémon
  //

  assert.equal(wildParticipant.pokemon.length, 1);

  assert.equal(wildParticipant.activePokemonIndex, 0);

  const activeWildPokemon = getActiveBattlePokemon(wildParticipant);

  assert.equal(activeWildPokemon.pokemon.instanceId, wildRattata.instanceId);

  //
  // Battle isolation
  //

  assert.notStrictEqual(
    activeTrainerPokemon.pokemon,
    trainerCharmander,
    'Battle Pokémon must not reuse the persistent PokemonInstance object',
  );

  assert.notStrictEqual(
    activeTrainerPokemon.pokemon.moves,
    trainerCharmander.moves,
    'Battle Pokémon moves must not reuse the persistent moves array',
  );

  assert.notStrictEqual(
    activeWildPokemon.pokemon,
    wildRattata,
    'Wild battle Pokémon must also use an isolated snapshot',
  );

  //
  // Participant identity
  //

  assert.notEqual(
    trainerParticipant.id,
    wildParticipant.id,
    'Participants must have different ids',
  );

  //
  // HP initialization
  //

  assert.equal(activeTrainerPokemon.currentHp, trainerCharmander.currentHp);

  assert.equal(activeWildPokemon.currentHp, wildRattata.currentHp);

  console.log('✅ Pokemon wild battle factory smoke test passed');

  console.log({
    battleId: battle.battleId,
    type: battle.type,
    status: battle.status,

    trainer: {
      participantId: trainerParticipant.id,

      pokemonCount: trainerParticipant.pokemon.length,

      activePokemon: {
        speciesId: activeTrainerPokemon.pokemon.speciesId,

        level: activeTrainerPokemon.pokemon.level,

        currentHp: activeTrainerPokemon.currentHp,
      },
    },

    wild: {
      participantId: wildParticipant.id,

      pokemonCount: wildParticipant.pokemon.length,

      activePokemon: {
        speciesId: activeWildPokemon.pokemon.speciesId,

        level: activeWildPokemon.pokemon.level,

        currentHp: activeWildPokemon.currentHp,
      },
    },
  });
}

main();
