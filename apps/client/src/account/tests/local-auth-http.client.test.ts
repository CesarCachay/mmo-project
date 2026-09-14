import { afterEach, describe, expect, it, vi } from "vitest";

import {
  LocalAuthHttpClient,
  LocalAuthHttpError,
} from "../local-auth-http.client";

const AUTH_RESPONSE = {
  authenticated: true,

  account: {
    accountId: "11111111-1111-4111-8111-111111111111",

    provider: "LOCAL" as const,

    email: null,
  },

  session: {
    expiresAt: "2026-10-14T12:00:00.000Z",
  },
};

describe("LocalAuthHttpClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("registers using credentials include", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(AUTH_RESPONSE), {
        status: 201,

        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new LocalAuthHttpClient("http://localhost:3000");

    const result = await client.register({
      loginId: "Cesar.MMO",

      password: "StrongPassword123!",
    });

    expect(result).toEqual(AUTH_RESPONSE);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/auth/register",
      {
        method: "POST",

        credentials: "include",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          loginId: "Cesar.MMO",

          password: "StrongPassword123!",
        }),
      },
    );
  });

  it("logs in using the local auth endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(AUTH_RESPONSE), {
        status: 200,

        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new LocalAuthHttpClient("http://localhost:3000");

    await client.login({
      loginId: "cesar.mmo",

      password: "StrongPassword123!",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/auth/login",
      expect.objectContaining({
        method: "POST",

        credentials: "include",
      }),
    );
  });

  it("exposes the generic invalid credentials error from a 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            statusCode: 401,

            message: "Invalid login id or password",
          }),
          {
            status: 401,

            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      ),
    );

    const client = new LocalAuthHttpClient("http://localhost:3000");

    await expect(
      client.login({
        loginId: "missing-user",

        password: "WrongPassword123!",
      }),
    ).rejects.toMatchObject({
      status: 401,

      message: "Invalid login id or password",
    });
  });

  it("rejects an invalid successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            unexpected: true,
          }),
          {
            status: 200,

            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      ),
    );

    const client = new LocalAuthHttpClient("http://localhost:3000");

    await expect(
      client.login({
        loginId: "cesar",

        password: "StrongPassword123!",
      }),
    ).rejects.toBeInstanceOf(LocalAuthHttpError);
  });
});
