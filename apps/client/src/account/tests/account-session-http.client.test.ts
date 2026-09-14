import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AccountSessionHttpClient,
  AccountSessionHttpError,
} from "../account-session-http.client";

describe("AccountSessionHttpClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("logs out using browser credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
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

    const client = new AccountSessionHttpClient("http://localhost:3000");

    await client.logout();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/auth/logout",
      {
        method: "POST",

        credentials: "include",
      },
    );
  });

  it("rejects an invalid logout response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
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

    const client = new AccountSessionHttpClient("http://localhost:3000");

    await expect(client.logout()).rejects.toBeInstanceOf(
      AccountSessionHttpError,
    );
  });
});
