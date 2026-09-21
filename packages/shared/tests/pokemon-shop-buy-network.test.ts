import { describe, expect, it } from "vitest";

import {
  isPokemonShopBuyInput,
  isPokemonShopPurchasedPayload,
} from "../src/index.js";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const REQUEST_ID = "22222222-2222-4222-8222-222222222222";

describe("pokemon shop buy network contract", () => {
  it("accepts a valid purchase command", () => {
    expect(
      isPokemonShopBuyInput({
        sessionId: SESSION_ID,
        requestId: REQUEST_ID,
        itemId: "potion",
        quantity: 3,
      }),
    ).toBe(true);
  });

  it("rejects invalid ids, quantities or client-extended commands", () => {
    expect(
      isPokemonShopBuyInput({
        sessionId: "shop-session-1",
        requestId: REQUEST_ID,
        itemId: "potion",
        quantity: 1,
      }),
    ).toBe(false);

    expect(
      isPokemonShopBuyInput({
        sessionId: SESSION_ID,
        requestId: "purchase-request-1",
        itemId: "potion",
        quantity: 1,
      }),
    ).toBe(false);

    expect(
      isPokemonShopBuyInput({
        sessionId: SESSION_ID,
        requestId: REQUEST_ID,
        itemId: "potion",
        quantity: 0,
      }),
    ).toBe(false);

    expect(
      isPokemonShopBuyInput({
        sessionId: SESSION_ID,
        requestId: REQUEST_ID,
        itemId: "potion",
        quantity: 1,
        clientPrice: 1,
      }),
    ).toBe(false);
  });

  it("validates the authoritative purchase receipt", () => {
    expect(
      isPokemonShopPurchasedPayload({
        sessionId: SESSION_ID,
        requestId: REQUEST_ID,
        itemId: "potion",
        quantity: 2,
        unitPrice: 300,
        totalPrice: 600,
        money: 2_400,
        inventoryQuantity: 5,
      }),
    ).toBe(true);

    expect(
      isPokemonShopPurchasedPayload({
        sessionId: SESSION_ID,
        requestId: REQUEST_ID,
        itemId: "potion",
        quantity: 2,
        unitPrice: 300,
        totalPrice: 600,
        money: -1,
        inventoryQuantity: 5,
      }),
    ).toBe(false);
  });
});
