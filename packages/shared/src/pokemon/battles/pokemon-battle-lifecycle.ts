import type { BattleInstance } from "./pokemon-battle.types.js";

export function isBattleActive(battle: BattleInstance): boolean {
  return battle.status === "active";
}

export function completeBattle(battle: BattleInstance): BattleInstance {
  if (!isBattleActive(battle)) {
    throw new Error(
      `Battle "${battle.battleId}" cannot be completed from status "${battle.status}"`
    );
  }

  return {
    ...battle,
    status: "completed",
  };
}
