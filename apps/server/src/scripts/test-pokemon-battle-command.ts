import assert from 'node:assert/strict';

import {
  completeBattle,
  createBattleCommand,
  createPokemonInstance,
  getActiveBattlePokemon,
  type BattleParticipant,
} from '@cesar-mmo/shared';

import { createWildBattleInstance } from '../pokemon/battles/pokemon-wild-battle.factory';

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

function createTestBattle() {
  const trainerPokemon = createPokemonInstance(4, 5);

  const wildPokemon = createPokemonInstance(19, 3);

  const encounterSession: PokemonWildEncounterSession = {
    encounterId: globalThis.crypto.randomUUID(),

    playerId: 'test-player-01',

    trainerId: 'test-trainer-01',

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

  const trainerParticipant = getTrainerParticipant(battle.participants);

  return {
    battle,
    trainerParticipant,
  };
}

function main(): void {
  //
  // Valid command
  //

  const { battle, trainerParticipant } = createTestBattle();

  const activePokemon = getActiveBattlePokemon(trainerParticipant);

  const knownMove = activePokemon.pokemon.moves[0];

  assert.ok(knownMove, 'Trainer active Pokémon must know at least one move');

  const validCommand = createBattleCommand(battle, {
    participantId: trainerParticipant.id,

    action: {
      type: 'use-move',

      moveId: knownMove.moveId,
    },
  });

  assert.equal(validCommand.battleId, battle.battleId);

  assert.equal(validCommand.participantId, trainerParticipant.id);

  assert.equal(validCommand.action.type, 'use-move');

  if (validCommand.action.type === 'use-move') {
    assert.equal(validCommand.action.moveId, knownMove.moveId);
  }

  //
  // Unknown move
  //

  assert.throws(
    () => {
      createBattleCommand(battle, {
        participantId: trainerParticipant.id,

        action: {
          type: 'use-move',

          moveId: 999_999,
        },
      });
    },

    /does not know move/,
  );

  //
  // Invalid moveId
  //

  assert.throws(
    () => {
      createBattleCommand(battle, {
        participantId: trainerParticipant.id,

        action: {
          type: 'use-move',

          moveId: 0,
        },
      });
    },

    /Invalid moveId/,
  );

  //
  // Invalid participant
  //

  assert.throws(
    () => {
      createBattleCommand(battle, {
        participantId: 'missing-participant',

        action: {
          type: 'use-move',

          moveId: knownMove.moveId,
        },
      });
    },

    /not found/,
  );

  //
  // No PP
  //

  const noPpContext = createTestBattle();

  const noPpActivePokemon = getActiveBattlePokemon(
    noPpContext.trainerParticipant,
  );

  const noPpMove = noPpActivePokemon.pokemon.moves[0];

  assert.ok(noPpMove, 'Trainer active Pokémon must know at least one move');

  //
  // This is the battle-local snapshot.
  // We are NOT mutating Trainer persistent state.
  //

  noPpMove.currentPp = 0;

  assert.throws(
    () => {
      createBattleCommand(noPpContext.battle, {
        participantId: noPpContext.trainerParticipant.id,

        action: {
          type: 'use-move',

          moveId: noPpMove.moveId,
        },
      });
    },

    /no PP remaining/,
  );

  //
  // Completed battle
  //

  const completedContext = createTestBattle();

  const completedBattle = completeBattle(completedContext.battle);

  const completedActivePokemon = getActiveBattlePokemon(
    completedContext.trainerParticipant,
  );

  const completedMove = completedActivePokemon.pokemon.moves[0];

  assert.ok(
    completedMove,
    'Trainer active Pokémon must know at least one move',
  );

  assert.throws(
    () => {
      createBattleCommand(completedBattle, {
        participantId: completedContext.trainerParticipant.id,

        action: {
          type: 'use-move',

          moveId: completedMove.moveId,
        },
      });
    },

    /Cannot create command/,
  );

  console.log('✅ Pokemon BattleCommand smoke test passed');

  console.log({
    battleId: battle.battleId,

    participantId: trainerParticipant.id,

    pokemonInstanceId: activePokemon.pokemon.instanceId,

    moveId: knownMove.moveId,

    currentPp: knownMove.currentPp,
  });
}

main();
