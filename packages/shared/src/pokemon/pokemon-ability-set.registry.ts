import pokemonAbilitySetsData from "./data/pokemon-abilities.json" with { type: "json" };

import type { PokemonAbilitySet } from "./pokemon.types.js";

const pokemonAbilitySets = pokemonAbilitySetsData as PokemonAbilitySet[];

const pokemonAbilitySetBySpeciesId = new Map<number, PokemonAbilitySet>(
  pokemonAbilitySets.map((abilitySet) => [abilitySet.speciesId, abilitySet])
);

export function getPokemonAbilitySet(speciesId: number): PokemonAbilitySet | undefined {
  return pokemonAbilitySetBySpeciesId.get(speciesId);
}

export function getAllPokemonAbilitySets(): readonly PokemonAbilitySet[] {
  return pokemonAbilitySets;
}

export function getPokemonAbilitySetCount(): number {
  return pokemonAbilitySets.length;
}
