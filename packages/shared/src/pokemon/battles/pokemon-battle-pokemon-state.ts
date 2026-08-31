import type { PokemonInstance } from "../pokemon.types.js";
import type { BattlePokemonState } from "./pokemon-battle.types.js";

export function createBattlePokemonState(pokemon: PokemonInstance): BattlePokemonState {
  assertValidBattlePokemonSource(pokemon);

  return {
    pokemon: createPokemonInstanceBattleSnapshot(pokemon),
    currentHp: pokemon.currentHp,
  };
}

function createPokemonInstanceBattleSnapshot(pokemon: PokemonInstance): PokemonInstance {
  return {
    ...pokemon,

    moves: pokemon.moves.map((move) => ({
      ...move,
    })),
  };
}

function assertValidBattlePokemonSource(pokemon: PokemonInstance): void {
  if (pokemon.instanceId.trim().length === 0) {
    throw new Error(
      "Cannot create BattlePokemonState from a Pokémon with an empty instanceId"
    );
  }

  if (!Number.isInteger(pokemon.level) || pokemon.level <= 0) {
    throw new Error(
      `Cannot create BattlePokemonState for Pokémon "${pokemon.instanceId}" with invalid level ${pokemon.level}`
    );
  }

  if (!Number.isInteger(pokemon.currentHp) || pokemon.currentHp < 0) {
    throw new Error(
      `Cannot create BattlePokemonState for Pokémon "${pokemon.instanceId}" with invalid currentHp ${pokemon.currentHp}`
    );
  }
}
