import { afterEach, describe, expect, it, vi } from "vitest";

import { io } from "socket.io-client";

import { GameNetworkClient } from "../GameNetworkClient";

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => ({
    id: undefined,
    connected: false,
    on: vi.fn(),
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
});
