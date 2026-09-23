import { afterEach, describe, expect, it, vi } from "vitest";

import { io } from "socket.io-client";

import { GameNetworkClient } from "../GameNetworkClient";

import { POKEMON_CENTER_HEALING_EVENTS, POKEMON_SHOP_EVENTS } from "@cesar-mmo/shared";

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => ({
    id: undefined,
    connected: false,
    on: vi.fn(),
    off: vi.fn(),
    removeAllListeners: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  })),
}));

describe("GameNetworkClient connection", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("connects using browser credentials and the selected Trainer", () => {
    vi.stubEnv("VITE_API_URL", "http://server.test");

    new GameNetworkClient({
      selectedTrainerId: "22222222-2222-4222-8222-222222222222",
    });

    expect(vi.mocked(io)).toHaveBeenCalledWith("http://server.test", {
      withCredentials: true,

      auth: {
        selectedTrainerId: "22222222-2222-4222-8222-222222222222",
      },
    });
  });

  it("sends Pokémon Center healing using only the healing station id", () => {
    vi.stubEnv("VITE_API_URL", "http://server.test");

    const client = new GameNetworkClient({
      selectedTrainerId: "22222222-2222-4222-8222-222222222222",
    });

    const socket = vi.mocked(io).mock.results.at(-1)?.value;

    if (!socket) {
      throw new Error("Socket mock was not created");
    }

    client.requestPokemonCenterHealing("pokeCenterHealingStation01");

    expect(socket.emit).toHaveBeenCalledWith(POKEMON_CENTER_HEALING_EVENTS.HEAL, {
      healingStationId: "pokeCenterHealingStation01",
    });
  });

  it("accepts valid Pokémon Center healing events and ignores invalid payloads", () => {
    vi.stubEnv("VITE_API_URL", "http://server.test");

    const client = new GameNetworkClient({
      selectedTrainerId: "22222222-2222-4222-8222-222222222222",
    });

    const socket = vi.mocked(io).mock.results.at(-1)?.value;

    if (!socket) {
      throw new Error("Socket mock was not created");
    }

    const onHealed = vi.fn();

    client.onPokemonCenterHealed(onHealed);

    const registration = vi
      .mocked(socket.on)
      .mock.calls.find(
        (call: unknown[]) => call[0] === POKEMON_CENTER_HEALING_EVENTS.HEALED
      );

    if (!registration) {
      throw new Error("HEALED listener was not registered");
    }

    const handler = registration[1];

    if (typeof handler !== "function") {
      throw new Error("HEALED listener callback was not registered");
    }

    handler({
      healingStationId: "pokeCenterHealingStation01",
      restoredPokemonCount: 2,
      totalHpRestored: 40,
      totalPpRestored: 30,
    });

    expect(onHealed).toHaveBeenCalledTimes(1);

    handler({
      healingStationId: "pokeCenterHealingStation01",
      restoredPokemonCount: -1,
      totalHpRestored: 40,
      totalPpRestored: 30,
    });

    expect(onHealed).toHaveBeenCalledTimes(1);
  });
  it("opens and closes an authoritative Poké Shop session", () => {
    vi.stubEnv("VITE_API_URL", "http://server.test");

    const client = new GameNetworkClient({
      selectedTrainerId: "22222222-2222-4222-8222-222222222222",
    });

    const socket = vi.mocked(io).mock.results.at(-1)?.value;

    if (!socket) {
      throw new Error("Socket mock was not created");
    }

    client.openPokemonShop("shopClerk");
    client.buyPokemonShopItem({
      sessionId: "shop-session-1",
      requestId: "purchase-request-1",
      itemId: "potion",
      quantity: 2,
    });
    client.sellPokemonShopItem({
      sessionId: "shop-session-1",
      requestId: "sale-request-1",
      itemId: "potion",
      quantity: 1,
    });
    client.closePokemonShop("shop-session-1");

    expect(socket.emit).toHaveBeenCalledWith(POKEMON_SHOP_EVENTS.OPEN, {
      npcId: "shopClerk",
    });
    expect(socket.emit).toHaveBeenCalledWith(POKEMON_SHOP_EVENTS.BUY, {
      sessionId: "shop-session-1",
      requestId: "purchase-request-1",
      itemId: "potion",
      quantity: 2,
    });
    expect(socket.emit).toHaveBeenCalledWith(POKEMON_SHOP_EVENTS.SELL, {
      sessionId: "shop-session-1",
      requestId: "sale-request-1",
      itemId: "potion",
      quantity: 1,
    });
    expect(socket.emit).toHaveBeenCalledWith(POKEMON_SHOP_EVENTS.CLOSE, {
      sessionId: "shop-session-1",
    });
  });

  it("forwards disconnect reasons and can remove the listener", () => {
    vi.stubEnv("VITE_API_URL", "http://server.test");

    const client = new GameNetworkClient({
      selectedTrainerId: "22222222-2222-4222-8222-222222222222",
    });

    const socket = vi.mocked(io).mock.results.at(-1)?.value;
    if (!socket) {
      throw new Error("Socket mock was not created");
    }

    const onDisconnect = vi.fn();
    const dispose = client.onDisconnect(onDisconnect);

    const registration = vi
      .mocked(socket.on)
      .mock.calls.find((call: unknown[]) => call[0] === "disconnect");

    if (!registration || typeof registration[1] !== "function") {
      throw new Error("disconnect listener was not registered");
    }

    registration[1]("transport close");
    expect(onDisconnect).toHaveBeenCalledWith("transport close");

    dispose();
    expect(socket.off).toHaveBeenCalledWith("disconnect", registration[1]);
  });

  it("removes listeners before destroying the socket", () => {
    vi.stubEnv("VITE_API_URL", "http://server.test");

    const client = new GameNetworkClient({
      selectedTrainerId: "22222222-2222-4222-8222-222222222222",
    });

    const socket = vi.mocked(io).mock.results.at(-1)?.value;
    if (!socket) {
      throw new Error("Socket mock was not created");
    }

    client.destroy();

    expect(socket.removeAllListeners).toHaveBeenCalledOnce();
    expect(socket.disconnect).toHaveBeenCalledOnce();
  });
});
