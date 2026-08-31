import type { BattleMoveExecutionContext } from "./pokemon-battle-move-execution.js";

import type { BattleMoveDamageResult } from "./pokemon-battle-move-damage.js";

export interface BattleMoveDamageApplicationResult {
  readonly requestedDamage: number;
  readonly appliedDamage: number;
  readonly previousHp: number;
  readonly currentHp: number;
}

export function applyBattleMoveDamage(
  context: BattleMoveExecutionContext,
  damageResult: BattleMoveDamageResult
): BattleMoveDamageApplicationResult {
  const requestedDamage = damageResult.damage;

  if (!Number.isInteger(requestedDamage) || requestedDamage < 0) {
    throw new Error(
      `Invalid battle damage "${requestedDamage}" for move "${context.move.id}"`
    );
  }

  const previousHp = context.targetPokemon.currentHp;

  if (!Number.isInteger(previousHp) || previousHp < 0) {
    throw new Error(
      `Invalid target HP "${previousHp}" for Pokémon "${context.targetPokemon.pokemon.instanceId}"`
    );
  }

  const appliedDamage = Math.min(requestedDamage, previousHp);

  const currentHp = previousHp - appliedDamage;

  context.targetPokemon.currentHp = currentHp;

  return {
    requestedDamage,
    appliedDamage,
    previousHp,
    currentHp,
  };
}
