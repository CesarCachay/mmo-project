import type { PokemonInstance } from "../pokemon.types.js";

export interface PokemonStorage {
  readonly pokemon: readonly PokemonInstance[];
}

export function createPokemonStorage(
  pokemon: readonly PokemonInstance[] = []
): PokemonStorage {
  return {
    pokemon: [...pokemon],
  };
}
