export interface LocalAuthInput {
  readonly loginId: string;
  readonly password: string;
}

export interface LocalAuthAccount {
  readonly accountId: string;
  readonly provider: "LOCAL";
  readonly email: string | null;
}

export interface LocalAuthResponse {
  readonly authenticated: true;

  readonly account: LocalAuthAccount;

  readonly session: {
    readonly expiresAt: string;
  };
}

export class LocalAuthHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "LocalAuthHttpError";
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLocalAuthResponse(value: unknown): value is LocalAuthResponse {
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
    account.provider === "LOCAL" &&
    (account.email === null || typeof account.email === "string") &&
    typeof session.expiresAt === "string"
  );
}

function resolveErrorMessage(value: unknown, fallback: string): string {
  if (
    isRecord(value) &&
    typeof value.message === "string" &&
    value.message.trim()
  ) {
    return value.message;
  }

  return fallback;
}

export class LocalAuthHttpClient {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string = import.meta.env.VITE_API_URL?.trim() ||
      "http://localhost:3000",
  ) {
    this.baseUrl = baseUrl;
  }

  async register(input: LocalAuthInput): Promise<LocalAuthResponse> {
    return this.request("/auth/register", input);
  }

  async login(input: LocalAuthInput): Promise<LocalAuthResponse> {
    return this.request("/auth/login", input);
  }

  private async request(
    path: string,
    input: LocalAuthInput,
  ): Promise<LocalAuthResponse> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        loginId: input.loginId,
        password: input.password,
      }),
    });

    const body: unknown = await response.json();

    if (!response.ok) {
      throw new LocalAuthHttpError(
        response.status,
        resolveErrorMessage(body, "Authentication request failed"),
      );
    }

    if (!isLocalAuthResponse(body)) {
      throw new LocalAuthHttpError(
        response.status,
        "Invalid authentication response",
      );
    }

    return body;
  }
}
