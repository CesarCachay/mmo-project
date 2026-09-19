import { describe, expect, it } from 'vitest';

import {
  createPokemonInstance,
  resolveTrainerBattleContinuationOutcome,
} from '../src/index.js';
import { createBattleParticipant, createBattlePokemonState } from '../src/index.js';

function createBattle() {
  const player = createBattleParticipant({
    id: 'player-participant',
    type: 'trainer',
    side: 'side-a',
    pokemon: [
      createBattlePokemonState(createPokemonInstance(1, 10)),
      createBattlePokemonState(createPokemonInstance(4, 10)),
    ],
    activePokemonIndex: 0,
  });

  const opponent = createBattleParticipant({
    id: 'npc-participant',
    type: 'trainer',
    side: 'side-b',
    pokemon: [
      createBattlePokemonState(createPokemonInstance(19, 7)),
      createBattlePokemonState(createPokemonInstance(16, 9)),
    ],
    activePokemonIndex: 0,
  });

  return {
    battleId: 'trainer-battle-a',
    type: 'trainer' as const,
    status: 'active' as const,
    participants: [player, opponent],
  };
}

describe('resolveTrainerBattleContinuationOutcome', () => {
  it('continues while both active Pokémon can battle', () => {
    const battle = createBattle();
    expect(resolveTrainerBattleContinuationOutcome(battle, 'player-participant')).toEqual({
      type: 'continue',
    });
  });

  it('requires a player replacement when the local active Pokémon faints', () => {
    const battle = createBattle();
    battle.participants[0]!.pokemon[0]!.currentHp = 0;

    expect(resolveTrainerBattleContinuationOutcome(battle, 'player-participant')).toEqual({
      type: 'player-replacement-required',
      replacementPokemonIndexes: [1],
    });
  });

  it('requires an opponent replacement when the NPC active Pokémon faints', () => {
    const battle = createBattle();
    battle.participants[1]!.pokemon[0]!.currentHp = 0;

    expect(resolveTrainerBattleContinuationOutcome(battle, 'player-participant')).toEqual({
      type: 'opponent-replacement-required',
      replacementPokemonIndexes: [1],
    });
  });

  it('reports opponent defeat when the full NPC party is fainted', () => {
    const battle = createBattle();
    battle.participants[1]!.pokemon.forEach((pokemon) => {
      pokemon.currentHp = 0;
    });

    expect(resolveTrainerBattleContinuationOutcome(battle, 'player-participant')).toEqual({
      type: 'opponent-defeated',
    });
  });
});
