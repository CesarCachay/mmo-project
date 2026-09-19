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

export function isWildBattleInstance(
  battle: BattleInstance
): battle is Extract<BattleInstance, { readonly type: "wild" }> {
  return battle.type === "wild";
}

export function isTrainerBattleInstance(
  battle: BattleInstance
): battle is Extract<BattleInstance, { readonly type: "trainer" }> {
  return battle.type === "trainer";
}
