import { MAX_POKEMON_PARTY_SIZE } from "./pokemon.types.js";

export const POKEMON_PARTY_REORDER_EVENTS = {
  REORDER: "pokemon:party-reorder",
  REORDERED: "pokemon:party-reordered",
  ERROR: "pokemon:party-reorder-error",
} as const;

export interface PokemonPartyReorderInput {
  readonly pokemonInstanceId: string;
  readonly targetPosition: number;
}

export interface PokemonPartyReorderedPayload {
  readonly pokemonInstanceId: string;
  readonly targetPosition: number;
}

export type PokemonPartyReorderErrorCode =
  | "INVALID_INPUT"
  | "POKEMON_NOT_IN_PARTY"
  | "INVALID_POSITION"
  | "INCOMPATIBLE_STATE"
  | "PERSISTENCE_FAILED";

export interface PokemonPartyReorderErrorPayload {
  readonly code: PokemonPartyReorderErrorCode;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actualKeys = Object.keys(value);

  return (
    actualKeys.length === keys.length &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
}

export function isPokemonPartyReorderInput(
  value: unknown,
): value is PokemonPartyReorderInput {
  if (!isRecord(value)) {
    return false;
  }

  if (!hasExactKeys(value, ["pokemonInstanceId", "targetPosition"])) {
    return false;
  }

  return (
    typeof value.pokemonInstanceId === "string" &&
    value.pokemonInstanceId.trim().length > 0 &&
    typeof value.targetPosition === "number" &&
    Number.isInteger(value.targetPosition) &&
    value.targetPosition >= 0 &&
    value.targetPosition < MAX_POKEMON_PARTY_SIZE
  );
}

export function isPokemonPartyReorderedPayload(
  value: unknown,
): value is PokemonPartyReorderedPayload {
  if (!isRecord(value)) {
    return false;
  }

  if (!hasExactKeys(value, ["pokemonInstanceId", "targetPosition"])) {
    return false;
  }

  return (
    typeof value.pokemonInstanceId === "string" &&
    value.pokemonInstanceId.trim().length > 0 &&
    typeof value.targetPosition === "number" &&
    Number.isInteger(value.targetPosition) &&
    value.targetPosition >= 0 &&
    value.targetPosition < MAX_POKEMON_PARTY_SIZE
  );
}

export function isPokemonPartyReorderErrorCode(
  value: unknown,
): value is PokemonPartyReorderErrorCode {
  return (
    value === "INVALID_INPUT" ||
    value === "POKEMON_NOT_IN_PARTY" ||
    value === "INVALID_POSITION" ||
    value === "INCOMPATIBLE_STATE" ||
    value === "PERSISTENCE_FAILED"
  );
}

export function isPokemonPartyReorderErrorPayload(
  value: unknown,
): value is PokemonPartyReorderErrorPayload {
  if (!isRecord(value)) {
    return false;
  }

  if (!hasExactKeys(value, ["code"])) {
    return false;
  }

  return isPokemonPartyReorderErrorCode(value.code);
}
