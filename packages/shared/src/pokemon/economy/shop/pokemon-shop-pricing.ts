import type { PokemonItemId } from "../../inventory/pokemon-inventory.js";
import type { PokemonMoney } from "../pokemon-money.js";
import {
  getPokemonItemBuyPrice,
  getPokemonItemSellPrice,
} from "../pokemon-item-economy.registry.js";
import {
  getPokemonShopCatalog,
  isPokemonShopItemStocked,
  type PokemonShopCatalogId,
} from "./pokemon-shop.catalog.js";

export const POKEMON_SHOP_MAX_TRANSACTION_QUANTITY = 99;

export interface PokemonShopPriceQuote {
  readonly itemId: PokemonItemId;
  readonly quantity: number;
  readonly unitPrice: PokemonMoney;
  readonly totalPrice: PokemonMoney;
}

export function quotePokemonShopPurchase(
  catalogId: PokemonShopCatalogId,
  itemId: PokemonItemId,
  quantity: number,
): PokemonShopPriceQuote | null {
  assertPokemonShopTransactionQuantity(quantity);

  if (!isPokemonShopItemStocked(catalogId, itemId)) {
    return null;
  }

  const unitPrice = getPokemonItemBuyPrice(itemId);

  if (unitPrice === null) {
    return null;
  }

  return createPriceQuote(itemId, quantity, unitPrice);
}

export function quotePokemonShopSale(
  catalogId: PokemonShopCatalogId,
  itemId: PokemonItemId,
  quantity: number,
): PokemonShopPriceQuote | null {
  assertPokemonShopTransactionQuantity(quantity);

  const catalog = getPokemonShopCatalog(catalogId);

  if (!catalog.buysItemsFromTrainer) {
    return null;
  }

  const unitPrice = getPokemonItemSellPrice(itemId);

  if (unitPrice === null) {
    return null;
  }

  return createPriceQuote(itemId, quantity, unitPrice);
}

export function isPokemonShopTransactionQuantity(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= POKEMON_SHOP_MAX_TRANSACTION_QUANTITY
  );
}

export function assertPokemonShopTransactionQuantity(
  value: number,
): asserts value is number {
  if (!isPokemonShopTransactionQuantity(value)) {
    throw new Error(
      `Pokémon shop transaction quantity must be an integer between 1 and ${POKEMON_SHOP_MAX_TRANSACTION_QUANTITY}, received "${value}"`,
    );
  }
}

function createPriceQuote(
  itemId: PokemonItemId,
  quantity: number,
  unitPrice: PokemonMoney,
): PokemonShopPriceQuote {
  return {
    itemId,
    quantity,
    unitPrice,
    totalPrice: unitPrice * quantity,
  };
}
