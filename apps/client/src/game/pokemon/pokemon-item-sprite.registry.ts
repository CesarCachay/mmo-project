import type { PokemonItemId } from "@cesar-mmo/shared";

export type PokemonItemSpriteSize = 48 | 64;

export interface PokemonItemSpriteAsset {
  readonly textureKey: string;
  readonly path: string;
  readonly size: PokemonItemSpriteSize;
}

const POKEMON_ITEM_ICON_BASE_PATH = "/assets/items/icons";

/**
 * Art can exist before gameplay support is enabled.
 * Keep this set asset-oriented rather than coupling it to the current
 * PokemonItemId union. When a new item becomes a domain item later,
 * the same filename convention starts working without changing paths.
 */
const AVAILABLE_POKEMON_ITEM_SPRITE_KEYS = new Set<string>([
  "poke-ball",
  "great-ball",
  "ultra-ball",
  "master-ball",
  "potion",
  "super-potion",
  "hyper-potion",
  "max-potion",
  "full-restore",
  "revive",
  "max-revive",
  "repel",
  "super-repel",
  "max-repel",
]);

const POKEMON_ITEM_SPRITE_KEY_OVERRIDES = new Map<string, string>();

function getPokemonItemSpriteKey(itemId: PokemonItemId): string {
  return POKEMON_ITEM_SPRITE_KEY_OVERRIDES.get(itemId) ?? itemId;
}

export function getPokemonItemSpriteAsset(
  itemId: PokemonItemId,
  size: PokemonItemSpriteSize = 48
): PokemonItemSpriteAsset | undefined {
  const spriteKey = getPokemonItemSpriteKey(itemId);

  if (!AVAILABLE_POKEMON_ITEM_SPRITE_KEYS.has(spriteKey)) {
    return undefined;
  }

  return {
    textureKey: `pokemon-item-${size}-${spriteKey}`,
    path: `${POKEMON_ITEM_ICON_BASE_PATH}/${size}/${spriteKey}.png`,
    size,
  };
}
