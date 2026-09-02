import type { BattleId } from "./pokemon-battle.types.js";
import type { BattleTurnNumber } from "./pokemon-battle-turn.js";

import {
  isBattlePresentationEvent,
  type BattlePresentationEvent,
} from "./pokemon-battle-presentation.js";

export interface PokemonBattleTurnResolvedPayload {
  readonly battleId: BattleId;
  readonly turnNumber: BattleTurnNumber;
  /**
   * Ordered exactly as the authoritative server
   * resolved the Battle Turn.
   */
  readonly events: readonly BattlePresentationEvent[];
}

export function isPokemonBattleTurnResolvedPayload(
  value: unknown
): value is PokemonBattleTurnResolvedPayload {
  if (!isRecord(value)) {
    return false;
  }

  if (!isNonEmptyString(value.battleId)) {
    return false;
  }

  if (!Number.isInteger(value.turnNumber) || (value.turnNumber as number) <= 0) {
    return false;
  }

  if (!Array.isArray(value.events)) {
    return false;
  }

  return value.events.every(isBattlePresentationEvent);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
