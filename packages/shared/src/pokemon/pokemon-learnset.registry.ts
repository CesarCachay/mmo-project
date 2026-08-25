import learnsetsData from "./data/learnsets.json" with { type: "json" };
import type { PokemonLearnset } from "./pokemon.types.js";

const POKEMON_LEARNSETS = new Map<number, PokemonLearnset>(
  learnsetsData.map((learnset) => [learnset.speciesId, learnset])
);

export function getPokemonLearnset(speciesId: number): PokemonLearnset | undefined {
  return POKEMON_LEARNSETS.get(speciesId);
}

export function getPokemonLearnsetCount(): number {
  return POKEMON_LEARNSETS.size;
}
