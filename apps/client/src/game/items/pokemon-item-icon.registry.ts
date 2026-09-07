import type { PokemonItemId } from "@cesar-mmo/shared";

export interface PokemonItemIconAsset {
  readonly textureKey: string;
  readonly path: string;
}

const ITEM_ICON_BASE_PATH = "/assets/items/icons/48";

export function getPokemonItemIconAsset(itemId: PokemonItemId): PokemonItemIconAsset {
  return {
    textureKey: `pokemon-item-icon-${itemId}`,

    path: `${ITEM_ICON_BASE_PATH}/${itemId}.png`,
  };
}
