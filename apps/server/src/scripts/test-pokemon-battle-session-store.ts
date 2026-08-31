import assert from 'node:assert/strict';

import {
  createPokemonInstance,
  type BattleParticipant,
} from '@cesar-mmo/shared';

import { createWildBattleInstance } from '../pokemon/battles/pokemon-wild-battle.factory';
import { PokemonBattleSessionStore } from '../pokemon/battles/pokemon-battle-session.store';

import type { PokemonWildEncounterSession } from '../pokemon/encounters/pokemon-wild-encounter-session';

function getTrainerParticipant(
  participants: readonly BattleParticipant[],
): BattleParticipant {
  const participant = participants.find(
    (candidate) => candidate.type === 'trainer',
  );

  assert.ok(participant, 'Trainer participant must exist');

  return participant;
}

function main(): void {
  //
  // Arrange Pokémon
  //

  const trainerCharmander = createPokemonInstance(4, 5);

  const trainerPidgey = createPokemonInstance(16, 4);

  const wildRattata = createPokemonInstance(19, 3);

  //
  // Arrange Wild Encounter
  //

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

  //
  // Create BattleInstance
  //

  const battle = createWildBattleInstance({
    encounterSession,
    trainerPokemon: [trainerCharmander, trainerPidgey],
  });

  const trainerParticipant = getTrainerParticipant(battle.participants);

  //
  // Create Store
  //

  const store = new PokemonBattleSessionStore();

  //
  // Create BattleSession
  //

  const session = store.create({
    battle,
    trainerBindings: [
      {
        participantId: trainerParticipant.id,
        trainerId: encounterSession.trainerId,
        playerId: encounterSession.playerId,
      },
    ],
  });

  //
  // Session creation
  //

  assert.equal(session.battle.battleId, battle.battleId);

  assert.equal(session.trainerBindings.length, 1);

  //
  // Lookup by BattleId
  //

  assert.strictEqual(store.getByBattleId(battle.battleId), session);

  assert.equal(store.hasBattle(battle.battleId), true);

  //
  // Lookup by TrainerId
  //

  assert.strictEqual(store.getByTrainerId(encounterSession.trainerId), session);

  assert.equal(store.hasTrainerBattle(encounterSession.trainerId), true);

  //
  // Lookup by PlayerId
  //

  assert.strictEqual(store.getByPlayerId(encounterSession.playerId), session);

  assert.equal(store.hasPlayerBattle(encounterSession.playerId), true);

  //
  // Duplicate BattleId guard
  //

  assert.throws(
    () => {
      store.create({
        battle,

        trainerBindings: [
          {
            participantId: trainerParticipant.id,
            trainerId: 'another-trainer',
            playerId: 'another-player',
          },
        ],
      });
    },

    /already exists/,
  );

  //
  // Duplicate Trainer guard
  //

  const secondWildPokemon = createPokemonInstance(16, 3);

  const secondEncounterSession: PokemonWildEncounterSession = {
    encounterId: globalThis.crypto.randomUUID(),
    playerId: 'test-player-02',
    // Same trainer intentionally
    trainerId: encounterSession.trainerId,
    mapId: 'route-01',
    zoneId: 'route-grass-zone-02',
    encounterTableId: 'town-grass',
    pokemon: secondWildPokemon,
    status: 'active',
  };

  const secondBattle = createWildBattleInstance({
    encounterSession: secondEncounterSession,
    trainerPokemon: [trainerCharmander],
  });

  const secondTrainerParticipant = getTrainerParticipant(
    secondBattle.participants,
  );

  assert.throws(
    () => {
      store.create({
        battle: secondBattle,

        trainerBindings: [
          {
            participantId: secondTrainerParticipant.id,
            trainerId: encounterSession.trainerId,
            playerId: 'test-player-02',
          },
        ],
      });
    },

    /already has active battle/,
  );

  //
  // Duplicate Player guard
  //

  const thirdWildPokemon = createPokemonInstance(25, 3);

  const thirdEncounterSession: PokemonWildEncounterSession = {
    encounterId: globalThis.crypto.randomUUID(),
    // Same player intentionally
    playerId: encounterSession.playerId,
    trainerId: 'test-trainer-03',
    mapId: 'route-01',
    zoneId: 'route-grass-zone-03',
    encounterTableId: 'town-grass',
    pokemon: thirdWildPokemon,
    status: 'active',
  };

  const thirdBattle = createWildBattleInstance({
    encounterSession: thirdEncounterSession,
    trainerPokemon: [trainerPidgey],
  });

  const thirdTrainerParticipant = getTrainerParticipant(
    thirdBattle.participants,
  );

  assert.throws(
    () => {
      store.create({
        battle: thirdBattle,

        trainerBindings: [
          {
            participantId: thirdTrainerParticipant.id,
            trainerId: thirdEncounterSession.trainerId,
            playerId: encounterSession.playerId,
          },
        ],
      });
    },

    /already has active battle/,
  );

  //
  // Complete Battle
  //

  const completedSession = store.complete(battle.battleId);

  assert.equal(completedSession.battle.status, 'completed');

  //
  // Battle remains addressable by battleId
  //

  assert.equal(store.hasBattle(battle.battleId), true);

  assert.strictEqual(store.getByBattleId(battle.battleId), completedSession);

  //
  // Trainer / Player are released
  //

  assert.equal(store.hasTrainerBattle(encounterSession.trainerId), false);

  assert.equal(store.hasPlayerBattle(encounterSession.playerId), false);

  assert.equal(store.getByTrainerId(encounterSession.trainerId), undefined);

  assert.equal(store.getByPlayerId(encounterSession.playerId), undefined);

  const nextWildPokemon = createPokemonInstance(25, 3);

  const nextEncounterSession: PokemonWildEncounterSession = {
    encounterId: globalThis.crypto.randomUUID(),

    playerId: encounterSession.playerId,

    trainerId: encounterSession.trainerId,

    mapId: 'route-01',

    zoneId: 'route-grass-zone-04',

    encounterTableId: 'town-grass',

    pokemon: nextWildPokemon,

    status: 'active',
  };

  const nextBattle = createWildBattleInstance({
    encounterSession: nextEncounterSession,

    trainerPokemon: [trainerCharmander],
  });

  const nextTrainerParticipant = getTrainerParticipant(nextBattle.participants);

  const nextSession = store.create({
    battle: nextBattle,

    trainerBindings: [
      {
        participantId: nextTrainerParticipant.id,

        trainerId: nextEncounterSession.trainerId,

        playerId: nextEncounterSession.playerId,
      },
    ],
  });

  assert.equal(nextSession.battle.status, 'active');

  assert.equal(store.hasTrainerBattle(encounterSession.trainerId), true);

  //
  // Completing twice must fail
  //

  assert.throws(() => {
    store.complete(battle.battleId);
  }, /cannot be completed/);

  //
  // Remove
  //

  store.remove(battle.battleId);

  store.remove(nextBattle.battleId);

  assert.equal(store.hasBattle(battle.battleId), false);

  assert.equal(store.hasTrainerBattle(encounterSession.trainerId), false);

  assert.equal(store.hasPlayerBattle(encounterSession.playerId), false);

  assert.equal(store.getByBattleId(battle.battleId), undefined);

  assert.equal(store.getByTrainerId(encounterSession.trainerId), undefined);

  assert.equal(store.getByPlayerId(encounterSession.playerId), undefined);

  console.log('✅ Pokemon BattleSessionStore smoke test passed');

  console.log({
    battleId: battle.battleId,
    trainerId: encounterSession.trainerId,
    playerId: encounterSession.playerId,
    trainerParticipantId: trainerParticipant.id,
    removed: true,
  });
}

main();
