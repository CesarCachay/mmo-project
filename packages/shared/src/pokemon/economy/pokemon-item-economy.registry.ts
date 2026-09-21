import type { PokemonItemId } from "../inventory/pokemon-inventory.js";
import type { PokemonMoney } from "./pokemon-money.js";

export interface PokemonItemEconomyDefinition {
  readonly itemId: PokemonItemId;
  /**
   * Base purchase price when a shop stocks this item.
   * null means the item is not purchasable from shops.
   */
  readonly buyPrice: PokemonMoney | null;
  /**
   * Base amount paid to the trainer when selling one unit.
   * null means shops must reject selling this item.
   */
  readonly sellPrice: PokemonMoney | null;
}

export const POKEMON_ITEM_ECONOMY_REGISTRY = {
  potion: {
    itemId: "potion",
    buyPrice: 300,
    sellPrice: 150,
  },
  "super-potion": {
    itemId: "super-potion",
    buyPrice: 700,
    sellPrice: 350,
  },
  "hyper-potion": {
    itemId: "hyper-potion",
    buyPrice: 1_200,
    sellPrice: 600,
  },
  "max-potion": {
    itemId: "max-potion",
    buyPrice: 2_500,
    sellPrice: 1_250,
  },
  "poke-ball": {
    itemId: "poke-ball",
    buyPrice: 200,
    sellPrice: 100,
  },
  revive: {
    itemId: "revive",
    buyPrice: 1_500,
    sellPrice: 750,
  },
  "max-revive": {
    itemId: "max-revive",
    buyPrice: null,
    sellPrice: 2_000,
  },
  "rare-candy": {
    itemId: "rare-candy",
    buyPrice: null,
    sellPrice: 2_400,
  },
} satisfies Record<PokemonItemId, PokemonItemEconomyDefinition>;

export function getPokemonItemEconomyDefinition(
  itemId: PokemonItemId,
): PokemonItemEconomyDefinition {
  return POKEMON_ITEM_ECONOMY_REGISTRY[itemId];
}

export function getPokemonItemBuyPrice(
  itemId: PokemonItemId,
): PokemonMoney | null {
  return getPokemonItemEconomyDefinition(itemId).buyPrice;
}

export function getPokemonItemSellPrice(
  itemId: PokemonItemId,
): PokemonMoney | null {
  return getPokemonItemEconomyDefinition(itemId).sellPrice;
}

export function isPokemonItemPurchasable(itemId: PokemonItemId): boolean {
  return getPokemonItemBuyPrice(itemId) !== null;
}

export function isPokemonItemSellable(itemId: PokemonItemId): boolean {
  return getPokemonItemSellPrice(itemId) !== null;
}
