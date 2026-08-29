import { POKEMON_STARTERS, type PokemonStarterId } from "@cesar-mmo/shared";

export interface PokemonStarterAsset {
  textureKey: string;
  path: string;
}

function getStarterAssetPath(speciesId: number): string {
  return `/assets/pokemon/starters/${String(speciesId).padStart(3, "0")}.png`;
}

export const POKEMON_STARTER_ASSETS = Object.fromEntries(
  Object.entries(POKEMON_STARTERS).map(([starterId, starter]) => [
    starterId,
    {
      textureKey: `pokemon-starter-${starter.speciesId}`,
      path: getStarterAssetPath(starter.speciesId),
    },
  ])
) as Record<PokemonStarterId, PokemonStarterAsset>;
