import {
  createBattleParticipant,
  createBattlePokemonState,
  createPokemonInstance,
  getPokemonMove,
  getPokemonTrainerBattleDefinition,
} from '@cesar-mmo/shared';

import type {
  PokemonInstance,
  PokemonTrainerBattleId,
  PokemonTrainerBattlePokemonDefinition,
  TrainerBattleInstance,
} from '@cesar-mmo/shared';

export interface CreateTrainerBattleInstanceInput {
  readonly trainerBattleId: PokemonTrainerBattleId;
  readonly trainerPokemon: readonly PokemonInstance[];
}

export function createTrainerBattleNpcPokemonInstance(
  definition: PokemonTrainerBattlePokemonDefinition,
): PokemonInstance {
  const pokemon = createPokemonInstance(definition.speciesId, definition.level);

  const moves = definition.moveIds.map((moveId) => {
    const move = getPokemonMove(moveId);

    if (!move) {
      throw new Error(
        `Trainer Battle move ${moveId} not found for species ${definition.speciesId}`,
      );
    }

    return {
      moveId,
      currentPp: move.pp ?? 0,
    };
  });

  return {
    ...pokemon,
    moves,
  };
}

export function createTrainerBattleInstance(
  input: CreateTrainerBattleInstanceInput,
): TrainerBattleInstance {
  const { trainerBattleId, trainerPokemon } = input;

  if (trainerPokemon.length === 0) {
    throw new Error(
      `Cannot create Trainer Battle "${trainerBattleId}" without player Pokémon`,
    );
  }

  const trainerBattlePokemon = trainerPokemon.map((pokemon) =>
    createBattlePokemonState(pokemon),
  );

  const initialTrainerPokemonIndex = trainerBattlePokemon.findIndex(
    (pokemonState) => pokemonState.currentHp > 0,
  );

  if (initialTrainerPokemonIndex === -1) {
    throw new Error(
      `Cannot create Trainer Battle "${trainerBattleId}" because all player Pokémon are fainted`,
    );
  }

  const trainerDefinition = getPokemonTrainerBattleDefinition(trainerBattleId);

  if (trainerDefinition.party.length === 0) {
    throw new Error(
      `Cannot create Trainer Battle "${trainerBattleId}" with an empty NPC party`,
    );
  }

  const npcBattlePokemon = trainerDefinition.party.map((pokemonDefinition) =>
    createBattlePokemonState(
      createTrainerBattleNpcPokemonInstance(pokemonDefinition),
    ),
  );

  const playerParticipant = createBattleParticipant({
    id: globalThis.crypto.randomUUID(),
    type: 'trainer',
    side: 'side-a',
    pokemon: trainerBattlePokemon,
    activePokemonIndex: initialTrainerPokemonIndex,
  });

  const npcParticipant = createBattleParticipant({
    id: globalThis.crypto.randomUUID(),
    type: 'trainer',
    side: 'side-b',
    pokemon: npcBattlePokemon,
    activePokemonIndex: 0,
  });

  return {
    battleId: globalThis.crypto.randomUUID(),
    type: 'trainer',
    status: 'active',
    participants: [playerParticipant, npcParticipant],
  };
}
