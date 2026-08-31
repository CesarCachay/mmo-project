import type { PokemonParty } from "../pokemon.types.js";

import type { BattleParticipant } from "./pokemon-battle.types.js";

export function syncPokemonPartyFromBattleParticipant(
  party: PokemonParty,
  participant: BattleParticipant
): PokemonParty {
  if (participant.type !== "trainer") {
    throw new Error(`Cannot sync Party from non-Trainer participant "${participant.id}"`);
  }

  if (participant.pokemon.length !== party.pokemon.length) {
    throw new Error(
      `Battle Trainer roster size "${participant.pokemon.length}" does not match Party size "${party.pokemon.length}"`
    );
  }

  const battlePokemonByInstanceId = new Map(
    participant.pokemon.map((state) => [state.pokemon.instanceId, state])
  );

  if (battlePokemonByInstanceId.size !== participant.pokemon.length) {
    throw new Error(
      `Battle Trainer participant "${participant.id}" contains duplicate Pokémon instance IDs`
    );
  }

  const updatedPokemon = party.pokemon.map((partyPokemon) => {
    const battlePokemon = battlePokemonByInstanceId.get(partyPokemon.instanceId);

    if (!battlePokemon) {
      throw new Error(
        `Party Pokémon "${partyPokemon.instanceId}" not found in Battle participant "${participant.id}"`
      );
    }

    if (!Number.isInteger(battlePokemon.currentHp) || battlePokemon.currentHp < 0) {
      throw new Error(
        `Invalid Battle HP "${battlePokemon.currentHp}" for Pokémon "${partyPokemon.instanceId}"`
      );
    }

    if (battlePokemon.pokemon.moves.length !== partyPokemon.moves.length) {
      throw new Error(
        `Battle move count does not match Party Pokémon "${partyPokemon.instanceId}"`
      );
    }

    const updatedMoves = partyPokemon.moves.map((partyMove, moveIndex) => {
      const battleMove = battlePokemon.pokemon.moves[moveIndex];

      if (!battleMove) {
        throw new Error(
          `Battle move slot "${moveIndex}" missing for Pokémon "${partyPokemon.instanceId}"`
        );
      }

      if (battleMove.moveId !== partyMove.moveId) {
        throw new Error(
          `Battle move "${battleMove.moveId}" does not match Party move "${partyMove.moveId}" at slot "${moveIndex}" for Pokémon "${partyPokemon.instanceId}"`
        );
      }

      if (!Number.isInteger(battleMove.currentPp) || battleMove.currentPp < 0) {
        throw new Error(
          `Invalid Battle PP "${battleMove.currentPp}" for move "${battleMove.moveId}"`
        );
      }

      return {
        ...partyMove,
        currentPp: battleMove.currentPp,
      };
    });

    return {
      ...partyPokemon,
      // HP authority during Battle lives in BattlePokemonState.currentHp.
      // Do not use: battlePokemon.pokemon.currentHp
      currentHp: battlePokemon.currentHp,
      moves: updatedMoves,
    };
  });

  return {
    ...party,
    pokemon: updatedPokemon,
  };
}
