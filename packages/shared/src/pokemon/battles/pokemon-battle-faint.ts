import type { BattlePokemonState } from "./pokemon-battle.types.js";

export function isBattlePokemonFainted(pokemon: BattlePokemonState): boolean {
  if (!Number.isInteger(pokemon.currentHp) || pokemon.currentHp < 0) {
    throw new Error(
      `Invalid battle Pokémon HP "${pokemon.currentHp}" for Pokémon "${pokemon.pokemon.instanceId}"`
    );
  }

  return pokemon.currentHp === 0;
}

export function isBattlePokemonAbleToAct(pokemon: BattlePokemonState): boolean {
  return !isBattlePokemonFainted(pokemon);
}
