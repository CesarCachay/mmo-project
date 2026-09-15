import { resolveApiBaseUrl } from "../config/runtime-environment";

export type AuthenticatedAccountSession = {
  authenticated: true;

  account: {
    accountId: string;
    provider: "GOOGLE";
    email: string | null;
  };

  session: {
    expiresAt: string;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAuthenticatedAccountSession(
  value: unknown,
): value is AuthenticatedAccountSession {
  if (!isRecord(value)) {
    return false;
  }

  if (
    value.authenticated !== true ||
    !isRecord(value.account) ||
    !isRecord(value.session)
  ) {
    return false;
  }

  const { account, session } = value;

  return (
    typeof account.accountId === "string" &&
    account.provider === "GOOGLE" &&
    (typeof account.email === "string" || account.email === null) &&
    typeof session.expiresAt === "string"
  );
}

export class AccountHttpClient {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = resolveApiBaseUrl(baseUrl);
  }

  async getSession(): Promise<AuthenticatedAccountSession | undefined> {
    const response = await fetch(`${this.baseUrl}/auth/session`, {
      method: "GET",
      credentials: "include",
    });

    if (response.status === 401) {
      return undefined;
    }

    if (!response.ok) {
      throw new Error(`Account session request failed: ${response.status}`);
    }

    return this.readSessionResponse(response);
  }

  async loginWithGoogle(
    credential: string,
  ): Promise<AuthenticatedAccountSession> {
    const response = await fetch(`${this.baseUrl}/auth/google`, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      credentials: "include",

      body: JSON.stringify({
        credential,
      }),
    });

    if (!response.ok) {
      throw new Error(`Google login failed: ${response.status}`);
    }

    return this.readSessionResponse(response);
  }

  async logout(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`Logout failed: ${response.status}`);
    }
  }

  private async readSessionResponse(
    response: Response,
  ): Promise<AuthenticatedAccountSession> {
    const body: unknown = await response.json();

    if (!isAuthenticatedAccountSession(body)) {
      throw new Error("Invalid account session response");
    }

    return body;
  }
}
