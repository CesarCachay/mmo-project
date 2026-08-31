import type { BattleMoveExecutionContext } from "./pokemon-battle-move-execution.js";

export interface BattleMovePpConsumptionResult {
  readonly moveId: number;
  readonly previousPp: number;
  readonly currentPp: number;
}

export function consumeBattleMovePp(
  context: BattleMoveExecutionContext
): BattleMovePpConsumptionResult {
  const selectedMove = context.selectedMove;

  const previousPp = selectedMove.currentPp;

  if (!Number.isInteger(previousPp) || previousPp <= 0) {
    throw new Error(
      `Cannot consume PP for move "${selectedMove.moveId}" with current PP "${previousPp}"`
    );
  }

  const currentPp = previousPp - 1;

  selectedMove.currentPp = currentPp;

  return {
    moveId: selectedMove.moveId,
    previousPp,
    currentPp,
  };
}
