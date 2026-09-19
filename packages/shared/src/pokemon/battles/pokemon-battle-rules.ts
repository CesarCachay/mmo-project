import type { BattleInstance } from "./pokemon-battle.types.js";
import type { BattleCommandAction } from "./pokemon-battle-command.js";
import type { PokemonItemId } from "../inventory/pokemon-inventory.js";
import { getPokemonItem } from "../items/pokemon-item.registry.js";

export type PokemonBattleRuleRejectionReason =
  | "run-not-allowed-in-trainer-battle"
  | "capture-not-allowed-in-trainer-battle"
  | "item-not-battle-usable"
  | "item-target-not-supported"
  | "item-effect-not-supported"
  | "item-target-mismatch";

export type PokemonBattleRuleDecision =
  | {
      readonly allowed: true;
    }
  | {
      readonly allowed: false;
      readonly reason: PokemonBattleRuleRejectionReason;
    };

const ALLOWED: PokemonBattleRuleDecision = { allowed: true };

export function evaluatePokemonBattleRunRule(
  battle: BattleInstance,
): PokemonBattleRuleDecision {
  if (battle.type === "trainer") {
    return {
      allowed: false,
      reason: "run-not-allowed-in-trainer-battle",
    };
  }

  return ALLOWED;
}

export function evaluatePokemonBattleItemRule(
  battle: BattleInstance,
  itemId: PokemonItemId,
): PokemonBattleRuleDecision {
  const item = getPokemonItem(itemId);

  if (!item.battleUsable) {
    return {
      allowed: false,
      reason: "item-not-battle-usable",
    };
  }

  switch (item.battleTarget) {
    case "wild-active": {
      if (battle.type === "trainer") {
        return {
          allowed: false,
          reason: "capture-not-allowed-in-trainer-battle",
        };
      }

      if (item.effect?.type !== "capture") {
        return {
          allowed: false,
          reason: "item-effect-not-supported",
        };
      }

      return ALLOWED;
    }

    case "trainer-pokemon": {
      if (
        item.effect?.type !== "heal-hp" &&
        item.effect?.type !== "revive"
      ) {
        return {
          allowed: false,
          reason: "item-effect-not-supported",
        };
      }

      return ALLOWED;
    }

    case null:
      return {
        allowed: false,
        reason: "item-target-not-supported",
      };
  }
}

export function evaluatePokemonBattleCommandActionRule(
  battle: BattleInstance,
  action: BattleCommandAction,
): PokemonBattleRuleDecision {
  switch (action.type) {
    case "run":
      return evaluatePokemonBattleRunRule(battle);

    case "use-item": {
      const itemDecision = evaluatePokemonBattleItemRule(battle, action.itemId);

      if (!itemDecision.allowed) {
        return itemDecision;
      }

      const item = getPokemonItem(action.itemId);

      if (item.battleTarget !== action.target.type) {
        return {
          allowed: false,
          reason: "item-target-mismatch",
        };
      }

      return ALLOWED;
    }

    case "use-move":
    case "switch-pokemon":
    case "struggle":
      return ALLOWED;
  }
}

export function assertPokemonBattleCommandActionAllowed(
  battle: BattleInstance,
  action: BattleCommandAction,
): void {
  const decision = evaluatePokemonBattleCommandActionRule(battle, action);

  if (decision.allowed) {
    return;
  }

  throw new Error(
    `Battle action "${action.type}" is not allowed in ${battle.type} battle "${battle.battleId}": ${decision.reason}`,
  );
}
