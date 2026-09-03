import speciesData from "./data/species.json" with { type: "json" };
import type { PokemonSpecies, PokemonType } from "./pokemon.types.js";

const POKEMON_SPECIES = new Map<number, PokemonSpecies>(
  speciesData.map((pokemon) => [
    pokemon.id,
    {
      id: pokemon.id,
      name: pokemon.name,

      types: pokemon.types as PokemonType[],

      baseStats: {
        hp: pokemon.baseStats.hp,
        attack: pokemon.baseStats.attack,
        defense: pokemon.baseStats.defense,
        specialAttack: pokemon.baseStats.specialAttack,
        specialDefense: pokemon.baseStats.specialDefense,
        speed: pokemon.baseStats.speed,
      },

      height: pokemon.height,
      weight: pokemon.weight,
      baseExperience: pokemon.baseExperience,

      captureRate: pokemon.captureRate,

      generation: pokemon.generation,
      evolutionChainId: pokemon.evolutionChainId,
    },
  ])
);

export function getPokemonSpecies(id: number): PokemonSpecies | undefined {
  return POKEMON_SPECIES.get(id);
}
