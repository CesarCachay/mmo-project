import {
  getPokemonFormsBySpecies,
  getPokemonSpecies,
  type PokemonInstance,
} from "@cesar-mmo/shared";

export function getPokemonDisplayName(pokemon: PokemonInstance): string {
  const nickname = pokemon.nickname?.trim();

  if (nickname) {
    return nickname;
  }

  const species = getPokemonSpecies(pokemon.speciesId);

  if (!species) {
    throw new Error(
      `Pokémon species ${pokemon.speciesId} not found while resolving presentation`
    );
  }

  return formatPokemonName(species.name);
}

export function getPokemonMaxHp(pokemon: PokemonInstance): number {
  const forms = getPokemonFormsBySpecies(pokemon.speciesId);
  const form = forms.find((candidate) => candidate.formId === pokemon.formId);

  if (!form) {
    throw new Error(
      `Pokémon form ${pokemon.formId} not found for species ${pokemon.speciesId}`
    );
  }

  return Math.floor((2 * form.baseStats.hp * pokemon.level) / 100) + pokemon.level + 10;
}

function formatPokemonName(name: string): string {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
