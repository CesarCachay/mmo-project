import { resolveApiBaseUrl } from "../config/runtime-environment";

export class AccountSessionHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AccountSessionHttpError";
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLogoutResponse(value: unknown): value is {
  success: true;
} {
  return isRecord(value) && value.success === true;
}

export class AccountSessionHttpClient {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = resolveApiBaseUrl(baseUrl);
  }

  async logout(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });

    const body: unknown = await response.json();

    if (!response.ok) {
      throw new AccountSessionHttpError(
        response.status,
        "Could not close Account session",
      );
    }

    if (!isLogoutResponse(body)) {
      throw new AccountSessionHttpError(
        response.status,
        "Invalid logout response",
      );
    }
  }
}
