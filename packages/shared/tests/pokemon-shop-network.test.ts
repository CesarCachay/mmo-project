import { describe, expect, it } from "vitest";

import {
  isPokemonShopCloseInput,
  isPokemonShopClosedPayload,
  isPokemonShopErrorPayload,
  isPokemonShopOpenInput,
  isPokemonShopOpenedPayload,
} from "../src/index.js";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";

describe("pokemon shop network contract", () => {
  it("accepts a valid open request and bounds NPC identifiers", () => {
    expect(isPokemonShopOpenInput({ npcId: "shopClerk" })).toBe(true);
    expect(isPokemonShopOpenInput({ npcId: "" })).toBe(false);
    expect(isPokemonShopOpenInput({ npcId: "x".repeat(65) })).toBe(false);
  });

  it("requires UUID shop session ids", () => {
    expect(isPokemonShopCloseInput({ sessionId: SESSION_ID })).toBe(true);
    expect(isPokemonShopCloseInput({ sessionId: "session-1" })).toBe(false);
    expect(isPokemonShopCloseInput({ sessionId: "" })).toBe(false);
  });

  it("validates authoritative opened payloads", () => {
    expect(
      isPokemonShopOpenedPayload({
        sessionId: SESSION_ID,
        npcId: "shopClerk",
        catalogId: "standard-poke-shop-v1",
        money: 3_000,
        inventory: { items: [{ itemId: "potion", quantity: 2 }] },
      }),
    ).toBe(true);

    expect(
      isPokemonShopOpenedPayload({
        sessionId: SESSION_ID,
        npcId: "shopClerk",
        catalogId: "unknown-shop",
        money: 3_000,
        inventory: { items: [] },
      }),
    ).toBe(false);
  });

  it("validates close and error payloads", () => {
    expect(
      isPokemonShopClosedPayload({
        sessionId: SESSION_ID,
        reason: "client-request",
      }),
    ).toBe(true);

    expect(
      isPokemonShopErrorPayload({
        code: "SHOP_NOT_AVAILABLE",
        message: "Move closer to the shop clerk and try again.",
      }),
    ).toBe(true);

    expect(
      isPokemonShopErrorPayload({
        code: "SHOP_NOT_AVAILABLE",
        message: "x".repeat(513),
      }),
    ).toBe(false);
  });
});
