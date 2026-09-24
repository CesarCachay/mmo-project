import {
  isPokemonItemId,
  type PokemonItemId,
} from "../inventory/pokemon-inventory.js";

export const POKEMON_OVERWORLD_ITEM_EVENTS = {
  USE: "pokemon:overworld-item-use",
  USED: "pokemon:overworld-item-used",
  ERROR: "pokemon:overworld-item-error",
} as const;

export interface PokemonOverworldItemUseInput {
  readonly itemId: PokemonItemId;
  readonly targetPokemonInstanceId: string;
}

export interface PokemonOverworldItemUsedPayload {
  readonly itemId: PokemonItemId;
  readonly targetPokemonInstanceId: string;

  readonly previousHp: number;
  readonly currentHp: number;
  readonly appliedHealing: number;
}

export type PokemonOverworldItemErrorCode =
  | "INVALID_INPUT"
  | "ITEM_NOT_AVAILABLE"
  | "ITEM_NOT_USABLE"
  | "INVALID_TARGET"
  | "TARGET_FAINTED"
  | "TARGET_NOT_FAINTED"
  | "TARGET_FULL_HP"
  | "TARGET_STATUS_NOT_APPLICABLE"
  | "INCOMPATIBLE_STATE"
  | "PERSISTENCE_FAILED";

export interface PokemonOverworldItemErrorPayload {
  readonly code: PokemonOverworldItemErrorCode;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const actualKeys = Object.keys(value).sort();

  const expected = [...expectedKeys].sort();

  return (
    actualKeys.length === expected.length &&
    actualKeys.every((key, index) => key === expected[index])
  );
}

export function isPokemonOverworldItemUseInput(
  value: unknown,
): value is PokemonOverworldItemUseInput {
  if (!isRecord(value)) {
    return false;
  }

  if (!hasExactKeys(value, ["itemId", "targetPokemonInstanceId"])) {
    return false;
  }

  return (
    isPokemonItemId(value.itemId) &&
    isNonEmptyString(value.targetPokemonInstanceId)
  );
}

export function isPokemonOverworldItemUsedPayload(
  value: unknown,
): value is PokemonOverworldItemUsedPayload {
  if (!isRecord(value)) {
    return false;
  }

  if (
    !hasExactKeys(value, [
      "itemId",
      "targetPokemonInstanceId",
      "previousHp",
      "currentHp",
      "appliedHealing",
    ])
  ) {
    return false;
  }

  if (
    !isPokemonItemId(value.itemId) ||
    !isNonEmptyString(value.targetPokemonInstanceId) ||
    !isNonNegativeInteger(value.previousHp) ||
    !isNonNegativeInteger(value.currentHp) ||
    !isNonNegativeInteger(value.appliedHealing)
  ) {
    return false;
  }

  if (value.currentHp < value.previousHp) {
    return false;
  }

  return value.appliedHealing === value.currentHp - value.previousHp;
}

export function isPokemonOverworldItemErrorPayload(
  value: unknown,
): value is PokemonOverworldItemErrorPayload {
  if (!isRecord(value)) {
    return false;
  }

  if (!hasExactKeys(value, ["code"])) {
    return false;
  }

  switch (value.code) {
    case "INVALID_INPUT":
    case "ITEM_NOT_AVAILABLE":
    case "ITEM_NOT_USABLE":
    case "INVALID_TARGET":
    case "TARGET_FAINTED":
    case "TARGET_NOT_FAINTED":
    case "TARGET_FULL_HP":
    case "TARGET_STATUS_NOT_APPLICABLE":
    case "INCOMPATIBLE_STATE":
    case "PERSISTENCE_FAILED":
      return true;

    default:
      return false;
  }
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}
