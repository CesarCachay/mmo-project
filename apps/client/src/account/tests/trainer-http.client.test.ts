import { afterEach, describe, expect, it, vi } from "vitest";

import { TrainerHttpClient, TrainerHttpError } from "../trainer-http.client";

const BASE_URL = "http://server.test";

const TRAINER = {
  trainerId: "22222222-2222-4222-8222-222222222222",
  displayName: "Cesar",
  avatarId: "male-01" as const,
  createdAt: "2026-09-14T12:00:00.000Z",
  updatedAt: "2026-09-14T12:00:00.000Z",
};

describe("TrainerHttpClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists trainers using the account session cookie", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          trainers: [TRAINER],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new TrainerHttpClient(BASE_URL);

    const trainers = await client.listTrainers();

    expect(trainers).toEqual([TRAINER]);

    expect(fetchMock).toHaveBeenCalledWith(`${BASE_URL}/trainers`, {
      method: "GET",
      credentials: "include",
    });
  });

  it("creates a trainer using the authenticated account", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          trainer: TRAINER,
        }),
        {
          status: 201,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new TrainerHttpClient(BASE_URL);

    const trainer = await client.createTrainer({
      displayName: "Cesar",
      avatarId: "male-01",
    });

    expect(trainer).toEqual(TRAINER);

    expect(fetchMock).toHaveBeenCalledWith(`${BASE_URL}/trainers`, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      credentials: "include",

      body: JSON.stringify({
        displayName: "Cesar",

        avatarId: "male-01",
      }),
    });
  });

  it("exposes status 401 when the account session is no longer valid", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 401,
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new TrainerHttpClient(BASE_URL);

    try {
      await client.listTrainers();

      throw new Error("Expected listTrainers to fail");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(TrainerHttpError);

      if (!(error instanceof TrainerHttpError)) {
        throw error;
      }

      expect(error.status).toBe(401);
    }
  });

  it("exposes status 409 when the trainer limit is reached", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          statusCode: 409,
          message: "Trainer limit reached",
        }),
        {
          status: 409,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new TrainerHttpClient(BASE_URL);

    try {
      await client.createTrainer({
        displayName: "Trainer4",

        avatarId: "female-01",
      });

      throw new Error("Expected createTrainer to fail");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(TrainerHttpError);

      if (!(error instanceof TrainerHttpError)) {
        throw error;
      }

      expect(error.status).toBe(409);
    }
  });

  it("rejects malformed trainer responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          trainers: [
            {
              trainerId: "trainer-1",
              displayName: "Cesar",
              avatarId: "invalid-avatar",
              createdAt: "2026-09-14T12:00:00.000Z",
              updatedAt: "2026-09-14T12:00:00.000Z",
            },
          ],
        }),
        {
          status: 200,

          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new TrainerHttpClient(BASE_URL);

    await expect(client.listTrainers()).rejects.toThrow(
      "Invalid trainer list response",
    );
  });
});
