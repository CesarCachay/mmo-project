import assert from 'node:assert/strict';

import {
  createBattleCommand,
  createPokemonInstance,
  getActiveBattlePokemon,
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
  const trainerPokemon = createPokemonInstance(4, 5);

  const wildPokemon = createPokemonInstance(19, 5);

  const encounterSession: PokemonWildEncounterSession = {
    encounterId: globalThis.crypto.randomUUID(),

    playerId: 'next-turn-player',

    trainerId: 'next-turn-trainer',

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

  getActiveBattlePokemon(trainer).pokemon.moves = [
    {
      moveId: TACKLE_MOVE_ID,

      currentPp: 10,
    },
  ];

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

function createCommands(
  battle: ReturnType<typeof createTestBattle>['battle'],
  trainer: BattleParticipant,
  wild: BattleParticipant,
) {
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

  return {
    trainerCommand,
    wildCommand,
  };
}

function main(): void {
  const { battle, trainer, wild } = createTestBattle();

  const store = new PokemonBattleTurnStore();

  //
  // Turn 1
  //

  const turn1 = store.create(battle);

  assert.equal(turn1.number, 1);

  assert.equal(turn1.commands.length, 0);

  console.log('✅ Turn 1 created');

  //
  // Cannot advance incomplete Turn.
  //

  assert.throws(() => {
    store.advance(battle);
  }, /incomplete turn/);

  console.log('✅ Incomplete Turn cannot advance');

  //
  // Submit Turn 1 commands.
  //

  const turn1Commands = createCommands(battle, trainer, wild);

  store.submitCommand(battle, turn1Commands.trainerCommand);

  const readyTurn1 = store.submitCommand(battle, turn1Commands.wildCommand);

  assert.equal(readyTurn1.commands.length, 2);

  //
  // Turn 1 → Turn 2.
  //

  const turn2 = store.advance(battle);

  assert.equal(turn2.battleId, battle.battleId);

  assert.equal(turn2.number, 2);

  assert.equal(turn2.commands.length, 0);

  assert.equal(store.getByBattleId(battle.battleId), turn2);

  console.log('✅ Turn 1 advanced to Turn 2');

  console.log('✅ Turn 2 starts with zero commands');

  //
  // Prove this is generic,
  // not hardcoded specifically for Turn 2.
  //

  const turn2Commands = createCommands(battle, trainer, wild);

  store.submitCommand(battle, turn2Commands.trainerCommand);

  store.submitCommand(battle, turn2Commands.wildCommand);

  const turn3 = store.advance(battle);

  assert.equal(turn3.number, 3);

  assert.equal(turn3.commands.length, 0);

  console.log('✅ Turn 2 advanced to Turn 3');

  console.log('✅ Next Turn lifecycle is generic');

  console.log('');

  console.log('============================================');

  console.log('✅ Pokemon BattleNextTurn smoke test passed');

  console.log('============================================');
}

main();
