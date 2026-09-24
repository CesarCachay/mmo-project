import type { PokemonPersistentMajorStatusState } from "../pokemon-status.js";
import {
  clonePokemonPersistentMajorStatusState,
  isPokemonMajorStatusCondition,
} from "../pokemon-status.js";
import type { BattlePokemonState } from "./pokemon-battle.types.js";

/**
 * Battle major status condition names share the durable Pokémon status domain.
 */
export type BattleMajorStatusCondition = import("../pokemon-status.js").PokemonMajorStatusCondition;

export type BattlePokemonMajorStatusState =
  | {
      readonly type: "burn";
    }
  | {
      readonly type: "poison";
    }
  | {
      readonly type: "badly-poisoned";
      toxicCounter: number;
    }
  | {
      readonly type: "paralysis";
    }
  | {
      readonly type: "sleep";
      turnsRemaining: number;
    }
  | {
      readonly type: "freeze";
    };

export interface BattlePokemonConfusionState {
  turnsRemaining: number;
}

/**
 * Mutable status state owned by the Battle Engine.
 *
 * Major status is synchronized to/from Trainer-owned Pokémon when Battle is
 * created/completed. Confusion remains Battle-only and is never persisted.
 */
export interface BattlePokemonStatusState {
  major: BattlePokemonMajorStatusState | null;
  confusion: BattlePokemonConfusionState | null;
}

export function createEmptyBattlePokemonStatusState(): BattlePokemonStatusState {
  return {
    major: null,
    confusion: null,
  };
}

export function createBattlePokemonStatusStateFromPersistent(
  status: PokemonPersistentMajorStatusState | null | undefined,
): BattlePokemonStatusState {
  return {
    major: createBattleMajorStatusFromPersistent(status),
    confusion: null,
  };
}

export function createBattleMajorStatusFromPersistent(
  status: PokemonPersistentMajorStatusState | null | undefined,
): BattlePokemonMajorStatusState | null {
  if (!status) {
    return null;
  }

  switch (status.type) {
    case "badly-poisoned":
      return {
        type: status.type,
        toxicCounter: 1,
      };

    case "sleep":
      return {
        type: status.type,
        turnsRemaining: status.turnsRemaining,
      };

    case "burn":
    case "poison":
    case "paralysis":
    case "freeze":
      return {
        type: status.type,
      };
  }
}

export function createPersistentMajorStatusFromBattle(
  status: BattlePokemonMajorStatusState | null | undefined,
): PokemonPersistentMajorStatusState | null {
  if (!status) {
    return null;
  }

  if (status.type === "sleep") {
    return {
      type: status.type,
      turnsRemaining: status.turnsRemaining,
    };
  }

  if (status.type === "badly-poisoned") {
    return {
      type: status.type,
    };
  }

  return clonePokemonPersistentMajorStatusState(status);
}

/**
 * Normalizes legacy/in-memory BattlePokemonState objects that predate the
 * Status Conditions V1 contract without forcing every historical fixture to
 * change immediately.
 */
export function ensureBattlePokemonStatusState(
  pokemon: BattlePokemonState,
): BattlePokemonStatusState {
  pokemon.statusState ??= createBattlePokemonStatusStateFromPersistent(
    pokemon.pokemon.majorStatus,
  );
  return pokemon.statusState;
}

export function hasBattlePokemonMajorStatus(
  pokemon: BattlePokemonState,
): boolean {
  return ensureBattlePokemonStatusState(pokemon).major !== null;
}

/**
 * Confusion is volatile and must disappear when the Pokémon leaves the active
 * battle slot. Major status conditions intentionally remain untouched.
 */
export function clearBattlePokemonConfusion(
  pokemon: BattlePokemonState,
): boolean {
  const state = ensureBattlePokemonStatusState(pokemon);

  if (state.confusion === null) {
    return false;
  }

  state.confusion = null;
  return true;
}

/**
 * Bad Poison remains a major status after switching, but its escalating toxic
 * counter returns to the first stage when the Pokémon leaves the active slot.
 */
export function resetBattlePokemonBadPoisonCounter(
  pokemon: BattlePokemonState,
): boolean {
  const major = ensureBattlePokemonStatusState(pokemon).major;

  if (major?.type !== "badly-poisoned") {
    return false;
  }

  const changed = major.toxicCounter !== 1;
  major.toxicCounter = 1;
  return changed;
}

export function isBattleMajorStatusCondition(
  value: unknown,
): value is BattleMajorStatusCondition {
  return isPokemonMajorStatusCondition(value);
}

export function isBattlePokemonStatusState(
  value: unknown,
): value is BattlePokemonStatusState {
  if (!isRecord(value)) {
    return false;
  }

  if (!isBattlePokemonMajorStatusState(value.major)) {
    return false;
  }

  return isBattlePokemonConfusionState(value.confusion);
}

function isBattlePokemonMajorStatusState(
  value: unknown,
): value is BattlePokemonMajorStatusState | null {
  if (value === null) {
    return true;
  }

  if (!isRecord(value) || !isBattleMajorStatusCondition(value.type)) {
    return false;
  }

  switch (value.type) {
    case "badly-poisoned":
      return isPositiveInteger(value.toxicCounter);

    case "sleep":
      return isPositiveInteger(value.turnsRemaining);

    case "burn":
    case "poison":
    case "paralysis":
    case "freeze":
      return true;
  }
}

function isBattlePokemonConfusionState(
  value: unknown,
): value is BattlePokemonConfusionState | null {
  if (value === null) {
    return true;
  }

  return isRecord(value) && isPositiveInteger(value.turnsRemaining);
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
