import { describe, expect, it } from "vitest";

import {
  resolveApiBaseUrl,
  type ClientRuntimeEnvironment,
} from "../runtime-environment";

const DEVELOPMENT_ENVIRONMENT: ClientRuntimeEnvironment = {
  production: false,
};

const PRODUCTION_ENVIRONMENT: ClientRuntimeEnvironment = {
  production: true,
};

describe("resolveApiBaseUrl", () => {
  it("prefers an explicitly provided base URL", () => {
    expect(
      resolveApiBaseUrl("  http://explicit.test  ", {
        apiUrl: "http://configured.test",
        production: true,
      }),
    ).toBe("http://explicit.test");
  });

  it("uses configured VITE_API_URL", () => {
    expect(
      resolveApiBaseUrl(undefined, {
        apiUrl: "  https://api.example.com  ",
        production: true,
      }),
    ).toBe("https://api.example.com");
  });

  it("uses localhost fallback during development", () => {
    expect(resolveApiBaseUrl(undefined, DEVELOPMENT_ENVIRONMENT)).toBe(
      "http://localhost:3000",
    );
  });

  it("fails when VITE_API_URL is missing in production", () => {
    expect(() => resolveApiBaseUrl(undefined, PRODUCTION_ENVIRONMENT)).toThrow(
      "VITE_API_URL is required in production",
    );
  });

  it("fails when VITE_API_URL contains only whitespace in production", () => {
    expect(() =>
      resolveApiBaseUrl(undefined, {
        apiUrl: "   ",
        production: true,
      }),
    ).toThrow("VITE_API_URL is required in production");
  });
});
