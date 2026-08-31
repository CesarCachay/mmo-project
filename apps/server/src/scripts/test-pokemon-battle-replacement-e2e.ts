import assert from 'node:assert/strict';

import {
  createBattleCommand,
  createPokemonInstance,
  getActiveBattlePokemon,
  isPokemonBattleReplacementInput,
  resolveWildBattleContinuationOutcome,
  type BattleParticipant,
} from '@cesar-mmo/shared';

import { createWildBattleInstance } from '../pokemon/battles/pokemon-wild-battle.factory.js';

import { PokemonBattleTurnStore } from '../pokemon/battles/pokemon-battle-turn.store.js';

import { applyPokemonTrainerBattleReplacement } from '../pokemon/battles/pokemon-trainer-battle-replacement.runtime.js';

import type { PokemonBattleSession } from '../pokemon/battles/pokemon-battle-session.js';

import type { PokemonWildEncounterSession } from '../pokemon/encounters/pokemon-wild-encounter-session.js';

const TACKLE_MOVE_ID = 33;

function getParticipant(
  participants: readonly BattleParticipant[],
  type: 'trainer' | 'wild',
): BattleParticipant {
  const participant = participants.find((candidate) => candidate.type === type);

  assert.ok(participant);

  return participant;
}

function createScenario() {
  const trainerOne = createPokemonInstance(4, 5);

  const trainerTwo = createPokemonInstance(7, 5);

  const wildPokemon = createPokemonInstance(19, 5);

  const playerId = `replacement-player-${globalThis.crypto.randomUUID()}`;

  const trainerId = `replacement-trainer-${globalThis.crypto.randomUUID()}`;

  const encounterSession: PokemonWildEncounterSession = {
    encounterId: globalThis.crypto.randomUUID(),

    playerId,

    trainerId,

    mapId: 'route-01',

    zoneId: 'route-grass-zone-01',

    encounterTableId: 'town-grass',

    pokemon: wildPokemon,

    status: 'active',
  };

  const battle = createWildBattleInstance({
    encounterSession,

    trainerPokemon: [trainerOne, trainerTwo],
  });

  const trainer = getParticipant(battle.participants, 'trainer');

  const wild = getParticipant(battle.participants, 'wild');

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

  const session: PokemonBattleSession = {
    battle,

    trainerBindings: [
      {
        participantId: trainer.id,

        trainerId,

        playerId,
      },
    ],
  };

  const turnStore = new PokemonBattleTurnStore();

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

  //
  // Simulate resolved Turn 1:
  // active Trainer Pokémon fainted.
  //

  getActiveBattlePokemon(trainer).currentHp = 0;

  return {
    battle,
    trainer,
    playerId,
    session,
    turnStore,
  };
}

function testNetworkValidator(): void {
  assert.equal(
    isPokemonBattleReplacementInput({
      battleId: 'battle-1',

      replacementPokemonIndex: 1,
    }),
    true,
  );

  assert.equal(
    isPokemonBattleReplacementInput({
      battleId: '',

      replacementPokemonIndex: 1,
    }),
    false,
  );

  assert.equal(
    isPokemonBattleReplacementInput({
      battleId: 'battle-1',

      replacementPokemonIndex: -1,
    }),
    false,
  );

  assert.equal(
    isPokemonBattleReplacementInput({
      battleId: 'battle-1',

      replacementPokemonIndex: 1.5,
    }),
    false,
  );

  console.log('✅ Replacement network validator');
}

function testReplacementE2E(): void {
  const scenario = createScenario();

  const before = resolveWildBattleContinuationOutcome(scenario.battle);

  assert.equal(before.type, 'trainer-replacement-required');

  const result = applyPokemonTrainerBattleReplacement({
    session: scenario.session,

    playerId: scenario.playerId,

    replacementPokemonIndex: 1,

    battleTurnStore: scenario.turnStore,
  });

  assert.equal(scenario.trainer.activePokemonIndex, 1);

  assert.equal(result.previousActivePokemonIndex, 0);

  assert.equal(result.currentActivePokemonIndex, 1);

  assert.equal(result.nextTurnNumber, 2);

  const turn2 = scenario.turnStore.getByBattleId(scenario.battle.battleId);

  assert.ok(turn2);

  assert.equal(turn2.number, 2);

  assert.equal(turn2.commands.length, 0);

  console.log('✅ Owner replacement applied');

  console.log('✅ Active Pokémon changed');

  console.log('✅ Turn lifecycle resumed at Turn 2');

  //
  // Same replacement cannot execute twice.
  //

  assert.throws(() => {
    applyPokemonTrainerBattleReplacement({
      session: scenario.session,

      playerId: scenario.playerId,

      replacementPokemonIndex: 1,

      battleTurnStore: scenario.turnStore,
    });
  }, /does not require Trainer replacement/);

  console.log('✅ Duplicate replacement rejected');
}

function testWrongPlayerRejected(): void {
  const scenario = createScenario();

  assert.throws(() => {
    applyPokemonTrainerBattleReplacement({
      session: scenario.session,

      playerId: 'different-player',

      replacementPokemonIndex: 1,

      battleTurnStore: scenario.turnStore,
    });
  }, /is not bound to battle/);

  assert.equal(scenario.trainer.activePokemonIndex, 0);

  console.log('✅ Non-owner replacement rejected');
}

function testInvalidCandidateRejected(): void {
  const scenario = createScenario();

  assert.throws(() => {
    applyPokemonTrainerBattleReplacement({
      session: scenario.session,

      playerId: scenario.playerId,

      replacementPokemonIndex: 99,

      battleTurnStore: scenario.turnStore,
    });
  }, /is not available/);

  assert.equal(scenario.trainer.activePokemonIndex, 0);

  console.log('✅ Invalid replacement candidate rejected');
}

function testReplacementNotRequiredRejected(): void {
  const scenario = createScenario();

  //
  // Restore active Pokémon before request.
  //

  scenario.trainer.pokemon[0].currentHp = 10;

  assert.throws(() => {
    applyPokemonTrainerBattleReplacement({
      session: scenario.session,

      playerId: scenario.playerId,

      replacementPokemonIndex: 1,

      battleTurnStore: scenario.turnStore,
    });
  }, /does not require Trainer replacement/);

  console.log('✅ Premature replacement rejected');
}

function main(): void {
  testNetworkValidator();

  testReplacementE2E();

  testWrongPlayerRejected();

  testInvalidCandidateRejected();

  testReplacementNotRequiredRejected();

  console.log('');

  console.log('============================================');

  console.log('✅ Pokemon BattleReplacement E2E smoke test passed');

  console.log('============================================');
}

main();
