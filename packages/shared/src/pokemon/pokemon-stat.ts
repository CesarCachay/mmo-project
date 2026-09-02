import { getPokemonFormsBySpecies } from "./pokemon-form.registry.js";

import type { PokemonInstance } from "./pokemon.types.js";

export function calculatePokemonMaxHp(
  pokemon: Pick<PokemonInstance, "speciesId" | "formId" | "level">
): number {
  const forms = getPokemonFormsBySpecies(pokemon.speciesId);

  const form = forms.find((candidate) => candidate.formId === pokemon.formId);

  if (!form) {
    throw new Error(
      `Pokémon form "${pokemon.formId}" not found for species "${pokemon.speciesId}"`
    );
  }

  return Math.floor((2 * form.baseStats.hp * pokemon.level) / 100) + pokemon.level + 10;
}
