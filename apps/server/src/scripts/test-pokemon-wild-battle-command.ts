import assert from 'node:assert/strict';

import {
  createPokemonInstance,
  getActiveBattlePokemon,
  type BattleParticipant,
} from '@cesar-mmo/shared';

import { createWildBattleInstance } from '../pokemon/battles/pokemon-wild-battle.factory';

import { createWildBattleCommand } from '../pokemon/battles/pokemon-wild-battle-command.factory';

import type { PokemonWildEncounterSession } from '../pokemon/encounters/pokemon-wild-encounter-session';

function getWildParticipant(
  participants: readonly BattleParticipant[],
): BattleParticipant {
  const participant = participants.find(
    (candidate) => candidate.type === 'wild',
  );

  assert.ok(participant, 'Wild participant must exist');

  return participant;
}

function createTestBattle() {
  const trainerPokemon = createPokemonInstance(4, 5);

  const wildPokemon = createPokemonInstance(19, 5);

  const encounterSession: PokemonWildEncounterSession = {
    encounterId: globalThis.crypto.randomUUID(),

    playerId: 'wild-command-player',

    trainerId: 'wild-command-trainer',

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

  return battle;
}

function main(): void {
  //
  // Valid deterministic selection.
  //

  const battle = createTestBattle();

  const wildParticipant = getWildParticipant(battle.participants);

  const activePokemon = getActiveBattlePokemon(wildParticipant);

  const availableMoves = activePokemon.pokemon.moves.filter(
    (move) => move.currentPp > 0,
  );

  assert.ok(availableMoves.length > 0, 'Wild Pokémon must have usable moves');

  const firstMove = availableMoves[0];

  assert.ok(firstMove);

  const command = createWildBattleCommand(battle, () => 0);

  assert.equal(command.battleId, battle.battleId);

  assert.equal(command.participantId, wildParticipant.id);

  assert.equal(command.action.type, 'use-move');

  if (command.action.type === 'use-move') {
    assert.equal(command.action.moveId, firstMove.moveId);
  }

  //
  // Invalid RNG.
  //

  assert.throws(() => {
    createWildBattleCommand(battle, () => 1);
  }, /Invalid battle random value/);

  assert.throws(() => {
    createWildBattleCommand(battle, () => -0.1);
  }, /Invalid battle random value/);

  //
  // No usable moves.
  //

  const noPpBattle = createTestBattle();

  const noPpWild = getWildParticipant(noPpBattle.participants);

  const noPpPokemon = getActiveBattlePokemon(noPpWild);

  for (const move of noPpPokemon.pokemon.moves) {
    move.currentPp = 0;
  }

  assert.throws(() => {
    createWildBattleCommand(noPpBattle, () => 0);
  }, /has no usable moves/);

  console.log('✅ Pokemon WildBattleCommand smoke test passed');

  console.log({
    battleId: battle.battleId,

    participantId: wildParticipant.id,

    selectedMove: command.action,
  });
}

main();
