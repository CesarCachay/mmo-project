import { POKEMON_STARTERS, type PokemonStarterId } from "@cesar-mmo/shared";

export interface PokemonStarterAsset {
  textureKey: string;
  path: string;
}

function getPokemonAssetPath(speciesId: number): string {
  const pokedexNumber = String(speciesId).padStart(3, "0");

  return `/assets/pokemon/starters/${pokedexNumber}.png`;
}

export const POKEMON_STARTER_ASSETS = Object.fromEntries(
  Object.entries(POKEMON_STARTERS).map(([starterId, starter]) => [
    starterId,
    {
      textureKey: `pokemon-${starter.speciesId}`,

      path: getPokemonAssetPath(starter.speciesId),
    },
  ]),
) as Record<PokemonStarterId, PokemonStarterAsset>;
