import { afterEach, describe, expect, it, vi } from "vitest";

import { AccountHttpClient } from "../account-http.client";

const BASE_URL = "http://server.test";

const SESSION_RESPONSE = {
  authenticated: true,

  account: {
    accountId: "11111111-1111-4111-8111-111111111111",
    provider: "GOOGLE",
    email: "cesar@example.com",
  },

  session: {
    expiresAt: "2026-10-13T12:00:00.000Z",
  },
} as const;

describe("AccountHttpClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the current session using browser credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(SESSION_RESPONSE), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new AccountHttpClient(BASE_URL);

    const result = await client.getSession();

    expect(result).toEqual(SESSION_RESPONSE);

    expect(fetchMock).toHaveBeenCalledWith(`${BASE_URL}/auth/session`, {
      method: "GET",
      credentials: "include",
    });
  });

  it("returns undefined when there is no authenticated session", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 401,
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new AccountHttpClient(BASE_URL);

    await expect(client.getSession()).resolves.toBeUndefined();
  });

  it("sends a Google credential without storing the account session token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(SESSION_RESPONSE), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new AccountHttpClient(BASE_URL);

    await client.loginWithGoogle("google-id-token");

    expect(fetchMock).toHaveBeenCalledWith(`${BASE_URL}/auth/google`, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      credentials: "include",

      body: JSON.stringify({
        credential: "google-id-token",
      }),
    });
  });

  it("logs out using the account session cookie", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 200,
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new AccountHttpClient(BASE_URL);

    await client.logout();

    expect(fetchMock).toHaveBeenCalledWith(`${BASE_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  });
});
