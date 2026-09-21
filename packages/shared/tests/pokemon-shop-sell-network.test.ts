import { describe, expect, it } from "vitest";

import {
  isPokemonShopSellInput,
  isPokemonShopSoldPayload,
} from "../src/index.js";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const REQUEST_ID = "33333333-3333-4333-8333-333333333333";

describe("pokemon shop sell network contract", () => {
  it("accepts a valid sale command", () => {
    expect(
      isPokemonShopSellInput({
        sessionId: SESSION_ID,
        requestId: REQUEST_ID,
        itemId: "potion",
        quantity: 2,
      }),
    ).toBe(true);
  });

  it("rejects invalid ids, quantities or client-priced sale commands", () => {
    expect(
      isPokemonShopSellInput({
        sessionId: "shop-session-1",
        requestId: REQUEST_ID,
        itemId: "potion",
        quantity: 1,
      }),
    ).toBe(false);

    expect(
      isPokemonShopSellInput({
        sessionId: SESSION_ID,
        requestId: "sale-request-1",
        itemId: "potion",
        quantity: 1,
      }),
    ).toBe(false);

    expect(
      isPokemonShopSellInput({
        sessionId: SESSION_ID,
        requestId: REQUEST_ID,
        itemId: "potion",
        quantity: 0,
      }),
    ).toBe(false);

    expect(
      isPokemonShopSellInput({
        sessionId: SESSION_ID,
        requestId: REQUEST_ID,
        itemId: "potion",
        quantity: 1,
        clientSellPrice: 999_999,
      }),
    ).toBe(false);
  });

  it("validates the authoritative sale receipt", () => {
    expect(
      isPokemonShopSoldPayload({
        sessionId: SESSION_ID,
        requestId: REQUEST_ID,
        itemId: "potion",
        quantity: 2,
        unitPrice: 150,
        totalPrice: 300,
        money: 3_300,
        inventoryQuantity: 3,
      }),
    ).toBe(true);

    expect(
      isPokemonShopSoldPayload({
        sessionId: SESSION_ID,
        requestId: REQUEST_ID,
        itemId: "potion",
        quantity: 2,
        unitPrice: 150,
        totalPrice: 300,
        money: 3_300,
        inventoryQuantity: -1,
      }),
    ).toBe(false);
  });
});
