import { MAX_POKEMON_PARTY_SIZE } from "../pokemon.types.js";

export const POKEMON_CENTER_HEALING_EVENTS = {
  HEAL: "pokemon:center-heal",
  HEALED: "pokemon:center-healed",
  ERROR: "pokemon:center-healing-error",
} as const;

export interface PokemonCenterHealInput {
  readonly healingStationId: string;
}

export interface PokemonCenterHealedPayload {
  readonly healingStationId: string;
  readonly restoredPokemonCount: number;
  readonly totalHpRestored: number;
  readonly totalPpRestored: number;
}

export type PokemonCenterHealingErrorCode =
  | "INVALID_INPUT"
  | "HEALING_NOT_AVAILABLE"
  | "INCOMPATIBLE_STATE"
  | "PERSISTENCE_CONFLICT"
  | "PERSISTENCE_FAILED";

export interface PokemonCenterHealingErrorPayload {
  readonly code: PokemonCenterHealingErrorCode;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[]
): boolean {
  const actualKeys = Object.keys(value).sort();

  const expected = [...expectedKeys].sort();

  return (
    actualKeys.length === expected.length &&
    actualKeys.every((key, index) => key === expected[index])
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function isPokemonCenterHealInput(
  value: unknown
): value is PokemonCenterHealInput {
  if (!isRecord(value)) {
    return false;
  }

  if (!hasExactKeys(value, ["healingStationId"])) {
    return false;
  }

  return isNonEmptyString(value.healingStationId);
}

export function isPokemonCenterHealedPayload(
  value: unknown
): value is PokemonCenterHealedPayload {
  if (!isRecord(value)) {
    return false;
  }

  if (
    !hasExactKeys(value, [
      "healingStationId",
      "restoredPokemonCount",
      "totalHpRestored",
      "totalPpRestored",
    ])
  ) {
    return false;
  }

  return (
    isNonEmptyString(value.healingStationId) &&
    isNonNegativeInteger(value.restoredPokemonCount) &&
    value.restoredPokemonCount <= MAX_POKEMON_PARTY_SIZE &&
    isNonNegativeInteger(value.totalHpRestored) &&
    isNonNegativeInteger(value.totalPpRestored)
  );
}

export function isPokemonCenterHealingErrorCode(
  value: unknown
): value is PokemonCenterHealingErrorCode {
  return (
    value === "INVALID_INPUT" ||
    value === "HEALING_NOT_AVAILABLE" ||
    value === "INCOMPATIBLE_STATE" ||
    value === "PERSISTENCE_CONFLICT" ||
    value === "PERSISTENCE_FAILED"
  );
}

export function isPokemonCenterHealingErrorPayload(
  value: unknown
): value is PokemonCenterHealingErrorPayload {
  if (!isRecord(value)) {
    return false;
  }

  if (!hasExactKeys(value, ["code"])) {
    return false;
  }

  return isPokemonCenterHealingErrorCode(value.code);
}
