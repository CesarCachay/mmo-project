import { isPlayerAvatarId } from "@cesar-mmo/shared";

import type { PlayerAvatarId } from "@cesar-mmo/shared";

export type AccountTrainer = {
  trainerId: string;
  displayName: string;
  avatarId: PlayerAvatarId;
  createdAt: string;
  updatedAt: string;
};

export type CreateAccountTrainerInput = {
  displayName: string;
  avatarId: PlayerAvatarId;
};

type TrainerListResponse = {
  trainers: AccountTrainer[];
};

type TrainerCreateResponse = {
  trainer: AccountTrainer;
};

export class TrainerHttpError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "TrainerHttpError";
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isAccountTrainer(value: unknown): value is AccountTrainer {
  if (!isRecord(value)) {
    return false;
  }

  if (typeof value.trainerId !== "string" || !value.trainerId) {
    return false;
  }

  if (!isNullableString(value.displayName)) {
    return false;
  }

  if (value.avatarId !== null && !isPlayerAvatarId(value.avatarId)) {
    return false;
  }

  return (
    typeof value.createdAt === "string" && typeof value.updatedAt === "string"
  );
}

function isTrainerListResponse(value: unknown): value is TrainerListResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.trainers) &&
    value.trainers.every(isAccountTrainer)
  );
}

function isTrainerCreateResponse(
  value: unknown,
): value is TrainerCreateResponse {
  return isRecord(value) && isAccountTrainer(value.trainer);
}

export class TrainerHttpClient {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    const configuredBaseUrl = import.meta.env.VITE_API_URL?.trim();

    this.baseUrl =
      baseUrl?.trim() || configuredBaseUrl || "http://localhost:3000";
  }

  async listTrainers(): Promise<AccountTrainer[]> {
    const response = await fetch(`${this.baseUrl}/trainers`, {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) {
      throw new TrainerHttpError(
        `Trainer list request failed: ${response.status}`,
        response.status,
      );
    }

    const body: unknown = await response.json();

    if (!isTrainerListResponse(body)) {
      throw new Error("Invalid trainer list response");
    }

    return body.trainers;
  }

  async createTrainer(
    input: CreateAccountTrainerInput,
  ): Promise<AccountTrainer> {
    const response = await fetch(`${this.baseUrl}/trainers`, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      credentials: "include",

      body: JSON.stringify({
        displayName: input.displayName,

        avatarId: input.avatarId,
      }),
    });

    if (!response.ok) {
      throw new TrainerHttpError(
        `Trainer creation failed: ${response.status}`,
        response.status,
      );
    }

    const body: unknown = await response.json();

    if (!isTrainerCreateResponse(body)) {
      throw new Error("Invalid trainer creation response");
    }

    return body.trainer;
  }
}
