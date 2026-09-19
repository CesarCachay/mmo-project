import { describe, expect, it } from 'vitest';

import {
  createPokemonInstance,
  getPokemonMove,
  getPokemonTrainerBattleDefinition,
} from '@cesar-mmo/shared';

import { createTrainerBattleInstance } from '../pokemon-trainer-battle.factory';

describe('createTrainerBattleInstance', () => {
  it('materializes the NPC party from the Trainer Battle Registry', () => {
    const playerPokemon = createPokemonInstance(1, 12);
    const trainerDefinition = getPokemonTrainerBattleDefinition('student-gary');

    const battle = createTrainerBattleInstance({
      trainerBattleId: 'student-gary',
      trainerPokemon: [playerPokemon],
    });

    expect(battle.type).toBe('trainer');
    expect(battle.status).toBe('active');
    expect(battle.participants).toHaveLength(2);

    const playerParticipant = battle.participants.find(
      (participant) => participant.side === 'side-a',
    );
    const npcParticipant = battle.participants.find(
      (participant) => participant.side === 'side-b',
    );

    expect(playerParticipant?.type).toBe('trainer');
    expect(playerParticipant?.pokemon[0]?.pokemon.instanceId).toBe(
      playerPokemon.instanceId,
    );

    expect(npcParticipant?.type).toBe('trainer');
    expect(npcParticipant?.activePokemonIndex).toBe(0);
    expect(npcParticipant?.pokemon).toHaveLength(
      trainerDefinition.party.length,
    );

    trainerDefinition.party.forEach((pokemonDefinition, index) => {
      const battlePokemon = npcParticipant?.pokemon[index]?.pokemon;

      expect(battlePokemon?.speciesId).toBe(pokemonDefinition.speciesId);
      expect(battlePokemon?.level).toBe(pokemonDefinition.level);
      expect(battlePokemon?.moves.map((move) => move.moveId)).toEqual(
        pokemonDefinition.moveIds,
      );

      expect(battlePokemon?.moves.map((move) => move.currentPp)).toEqual(
        pokemonDefinition.moveIds.map((moveId) => getPokemonMove(moveId).pp),
      );
    });
  });

  it('rejects a Trainer Battle when every player Pokémon is fainted', () => {
    const faintedPokemon = {
      ...createPokemonInstance(1, 12),
      currentHp: 0,
    };

    expect(() =>
      createTrainerBattleInstance({
        trainerBattleId: 'student-gary',
        trainerPokemon: [faintedPokemon],
      }),
    ).toThrow(/all player Pokémon are fainted/);
  });
});
