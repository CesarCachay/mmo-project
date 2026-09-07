import type { PokemonParty } from "../pokemon.types.js";

import type { PokemonStorage } from "./pokemon-storage.js";

export interface PokemonStorageStatePayload {
  readonly party: PokemonParty;
  readonly storage: PokemonStorage;
}

export interface PokemonStorageOpenInput {
  readonly terminalId: string;
}

export type PokemonStorageErrorCode =
  | "STORAGE_NOT_AVAILABLE"
  | "PARTY_FULL"
  | "LAST_PARTY_POKEMON"
  | "INVALID_POKEMON"
  | "INVALID_COMMAND"
  | "STALE_COMMAND";

export interface PokemonStorageErrorPayload {
  readonly code: PokemonStorageErrorCode;
  readonly message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isPokemonStorageOpenInput(
  value: unknown
): value is PokemonStorageOpenInput {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.terminalId === "string" && value.terminalId.trim().length > 0;
}
