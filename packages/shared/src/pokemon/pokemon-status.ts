/**
 * Major status conditions that may persist on a Trainer-owned Pokémon outside
 * an individual Battle session.
 *
 * Confusion is intentionally excluded because it is a volatile Battle-only
 * condition and must disappear when the Pokémon leaves the active slot or when
 * Battle ends.
 */
export type PokemonMajorStatusCondition =
  | "burn"
  | "poison"
  | "badly-poisoned"
  | "paralysis"
  | "sleep"
  | "freeze";

export type PokemonPersistentMajorStatusState =
  | {
      readonly type: "burn";
    }
  | {
      readonly type: "poison";
    }
  | {
      readonly type: "badly-poisoned";
    }
  | {
      readonly type: "paralysis";
    }
  | {
      readonly type: "sleep";
      readonly turnsRemaining: number;
    }
  | {
      readonly type: "freeze";
    };

export function isPokemonMajorStatusCondition(
  value: unknown,
): value is PokemonMajorStatusCondition {
  return (
    value === "burn" ||
    value === "poison" ||
    value === "badly-poisoned" ||
    value === "paralysis" ||
    value === "sleep" ||
    value === "freeze"
  );
}

export function isPokemonPersistentMajorStatusState(
  value: unknown,
): value is PokemonPersistentMajorStatusState | null {
  if (value === null) {
    return true;
  }

  if (!isRecord(value) || !isPokemonMajorStatusCondition(value.type)) {
    return false;
  }

  if (value.type === "sleep") {
    return isPositiveInteger(value.turnsRemaining);
  }

  return value.turnsRemaining === undefined;
}

export function clonePokemonPersistentMajorStatusState(
  status: PokemonPersistentMajorStatusState | null | undefined,
): PokemonPersistentMajorStatusState | null {
  if (!status) {
    return null;
  }

  return status.type === "sleep"
    ? {
        type: "sleep",
        turnsRemaining: status.turnsRemaining,
      }
    : {
        type: status.type,
      };
}

export function createPokemonPersistentMajorStatusState(
  type: PokemonMajorStatusCondition,
  turnsRemaining?: number,
): PokemonPersistentMajorStatusState {
  if (type === "sleep") {
    if (!isPositiveInteger(turnsRemaining)) {
      throw new Error(
        `Sleep status requires a positive turnsRemaining value, received "${turnsRemaining}"`,
      );
    }

    return {
      type,
      turnsRemaining,
    };
  }

  return { type };
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
