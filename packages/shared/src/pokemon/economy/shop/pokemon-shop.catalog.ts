import type { PokemonItemId } from "../../inventory/pokemon-inventory.js";
import { getPokemonItemBuyPrice } from "../pokemon-item-economy.registry.js";

export const POKEMON_SHOP_CATALOG_IDS = ["standard-poke-shop-v1"] as const;

export type PokemonShopCatalogId = (typeof POKEMON_SHOP_CATALOG_IDS)[number];

const POKEMON_SHOP_CATALOG_ID_SET: ReadonlySet<string> = new Set(
  POKEMON_SHOP_CATALOG_IDS,
);

export interface PokemonShopCatalogDefinition {
  readonly id: PokemonShopCatalogId;
  readonly displayName: string;
  /** Items the trainer is allowed to purchase from this catalog. */
  readonly stockedItemIds: readonly PokemonItemId[];
  /** Whether this catalog accepts globally sellable inventory items. */
  readonly buysItemsFromTrainer: boolean;
}

export const POKEMON_SHOP_CATALOG_REGISTRY = {
  "standard-poke-shop-v1": {
    id: "standard-poke-shop-v1",
    displayName: "Poké Shop",
    stockedItemIds: ["poke-ball", "potion", "super-potion", "revive"],
    buysItemsFromTrainer: true,
  },
} satisfies Record<PokemonShopCatalogId, PokemonShopCatalogDefinition>;

export function isPokemonShopCatalogId(
  value: unknown,
): value is PokemonShopCatalogId {
  return typeof value === "string" && POKEMON_SHOP_CATALOG_ID_SET.has(value);
}

export function getPokemonShopCatalog(
  catalogId: PokemonShopCatalogId,
): PokemonShopCatalogDefinition {
  return POKEMON_SHOP_CATALOG_REGISTRY[catalogId];
}

export function isPokemonShopItemStocked(
  catalogId: PokemonShopCatalogId,
  itemId: PokemonItemId,
): boolean {
  const catalog = getPokemonShopCatalog(catalogId);

  if (!catalog.stockedItemIds.includes(itemId)) {
    return false;
  }

  return getPokemonItemBuyPrice(itemId) !== null;
}
