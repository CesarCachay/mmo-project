import { describe, expect, it } from "vitest";

import {
  POKEMON_ITEM_IDS,
  POKEMON_ITEM_ECONOMY_REGISTRY,
  POKEMON_SHOP_MAX_TRANSACTION_QUANTITY,
  getPokemonItemBuyPrice,
  getPokemonItemSellPrice,
  getPokemonShopCatalog,
  isPokemonShopCatalogId,
  isPokemonItemPurchasable,
  isPokemonItemSellable,
  isPokemonShopItemStocked,
  isPokemonShopTransactionQuantity,
  quotePokemonShopPurchase,
  quotePokemonShopSale,
} from "../src/index.js";

const CATALOG_ID = "standard-poke-shop-v1" as const;

describe("pokemon shop catalog and pricing", () => {
  it("validates catalog ids before future network/shop-session use", () => {
    expect(isPokemonShopCatalogId(CATALOG_ID)).toBe(true);
    expect(isPokemonShopCatalogId("unknown-shop")).toBe(false);
  });

  it("defines economy metadata for every registered inventory item", () => {
    expect(Object.keys(POKEMON_ITEM_ECONOMY_REGISTRY).sort()).toEqual(
      [...POKEMON_ITEM_IDS].sort(),
    );
  });

  it("exposes the initial Poké Shop stock independently from the item registry", () => {
    expect(getPokemonShopCatalog(CATALOG_ID)).toMatchObject({
      displayName: "Poké Shop",
      buysItemsFromTrainer: true,
      stockedItemIds: [
        "poke-ball",
        "potion",
        "super-potion",
        "revive",
        "antidote",
        "burn-heal",
        "ice-heal",
        "awakening",
        "paralyze-heal",
        "full-heal",
      ],
    });

    expect(isPokemonShopItemStocked(CATALOG_ID, "poke-ball")).toBe(true);
    expect(isPokemonShopItemStocked(CATALOG_ID, "antidote")).toBe(true);
    expect(isPokemonShopItemStocked(CATALOG_ID, "full-heal")).toBe(true);
    expect(isPokemonShopItemStocked(CATALOG_ID, "hyper-potion")).toBe(false);
  });

  it("keeps buy and sell prices as economy rules instead of item behavior", () => {
    expect(getPokemonItemBuyPrice("potion")).toBe(300);
    expect(getPokemonItemSellPrice("potion")).toBe(150);
    expect(getPokemonItemBuyPrice("poke-ball")).toBe(200);
    expect(getPokemonItemSellPrice("poke-ball")).toBe(100);
  });

  it("supports sell-only items without making them purchasable", () => {
    expect(isPokemonItemPurchasable("max-revive")).toBe(false);
    expect(isPokemonItemSellable("max-revive")).toBe(true);
    expect(getPokemonItemSellPrice("max-revive")).toBe(2_000);

    expect(isPokemonItemPurchasable("rare-candy")).toBe(false);
    expect(isPokemonItemSellable("rare-candy")).toBe(true);
    expect(getPokemonItemSellPrice("rare-candy")).toBe(2_400);
  });

  it("quotes purchases using authoritative catalog stock and unit prices", () => {
    expect(quotePokemonShopPurchase(CATALOG_ID, "potion", 3)).toEqual({
      itemId: "potion",
      quantity: 3,
      unitPrice: 300,
      totalPrice: 900,
    });

    expect(quotePokemonShopPurchase(CATALOG_ID, "hyper-potion", 1)).toBeNull();
    expect(quotePokemonShopPurchase(CATALOG_ID, "rare-candy", 1)).toBeNull();
  });

  it("quotes sales for globally sellable items even when they are not stocked", () => {
    expect(quotePokemonShopSale(CATALOG_ID, "hyper-potion", 2)).toEqual({
      itemId: "hyper-potion",
      quantity: 2,
      unitPrice: 600,
      totalPrice: 1_200,
    });
  });

  it("rejects invalid transaction quantities before a future server mutation", () => {
    expect(isPokemonShopTransactionQuantity(1)).toBe(true);
    expect(isPokemonShopTransactionQuantity(POKEMON_SHOP_MAX_TRANSACTION_QUANTITY)).toBe(
      true,
    );
    expect(isPokemonShopTransactionQuantity(0)).toBe(false);
    expect(isPokemonShopTransactionQuantity(1.5)).toBe(false);
    expect(
      isPokemonShopTransactionQuantity(POKEMON_SHOP_MAX_TRANSACTION_QUANTITY + 1),
    ).toBe(false);

    expect(() => quotePokemonShopPurchase(CATALOG_ID, "potion", 0)).toThrow(
      /transaction quantity/,
    );
  });
});
