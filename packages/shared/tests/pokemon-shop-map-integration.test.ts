import { describe, expect, it } from "vitest";

import {
  MAP_DATA_REGISTRY,
  MAP_IDS,
  getPokemonShopCatalog,
  isPokemonShopCatalogId,
} from "../src/index.js";

describe("Poké Shop map integration", () => {
  it("registers the shop clerk with a valid catalog", () => {
    const clerk = MAP_DATA_REGISTRY[MAP_IDS.POKE_SHOP].npcs?.shopClerk;

    expect(clerk).toBeDefined();
    expect(clerk?.shopCatalogId).toBe("standard-poke-shop-v1");
    expect(isPokemonShopCatalogId(clerk?.shopCatalogId)).toBe(true);

    if (!clerk?.shopCatalogId) {
      throw new Error("shopClerk is missing shopCatalogId");
    }

    expect(getPokemonShopCatalog(clerk.shopCatalogId).displayName).toBe(
      "Poké Shop",
    );
  });
});
