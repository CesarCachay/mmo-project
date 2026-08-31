import type { BattleMoveExecutionContext } from "./pokemon-battle-move-execution.js";

export type BattleAccuracyRandomSource = () => number;

export interface BattleMoveAccuracyResult {
  readonly hit: boolean;
  readonly accuracy: number | null;
  readonly roll: number | null;
}

export function resolveBattleMoveAccuracy(
  context: BattleMoveExecutionContext,
  random: BattleAccuracyRandomSource
): BattleMoveAccuracyResult {
  const accuracy = context.move.accuracy;

  //
  // Pokémon moves with accuracy = null
  // do not perform a normal accuracy check.
  //
  // Within our current simplified battle
  // foundation they always hit.
  //

  if (accuracy === null) {
    return {
      hit: true,
      accuracy: null,
      roll: null,
    };
  }

  //
  // Validate static Move data before
  // using it in runtime battle logic.
  //

  if (!Number.isFinite(accuracy) || accuracy <= 0 || accuracy > 100) {
    throw new Error(`Invalid move accuracy "${accuracy}" for move "${context.move.id}"`);
  }

  const roll = random();

  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) {
    throw new Error(`Invalid battle accuracy random value "${roll}"`);
  }

  const hit = roll < accuracy / 100;

  return {
    hit,
    accuracy,
    roll,
  };
}
