import { BattleInstance } from "../pokemon-battle.types.js";
import type { BattleTurnResolutionEntry } from "../pokemon-battle-turn-order.js";

export type BattleRunRandomSource = () => number;

export type BattleRunResolution =
  | {
      readonly type: "run-succeeded";
    }
  | {
      readonly type: "run-failed";
    };

/*
 * Battle V1.
 *
 * La fórmula definitiva de escape puede evolucionar después.
 * Por ahora usamos una probabilidad simple y server-authoritative
 * para validar correctamente toda la arquitectura RUN:
 *
 * command
 * → Turn ordering
 * → authoritative RNG
 * → success / failure
 * → continuation / completion
 */
const BATTLE_RUN_SUCCESS_CHANCE = 0.5;

export function resolveBattleRunAttempt(
  battle: BattleInstance,
  entry: BattleTurnResolutionEntry,
  random: BattleRunRandomSource
): BattleRunResolution {
  if (battle.status !== "active") {
    throw new Error(
      `Cannot resolve run attempt for battle "${battle.battleId}" with status "${battle.status}"`
    );
  }

  if (battle.type !== "wild") {
    throw new Error(`Cannot run from unsupported battle type "${battle.type}"`);
  }

  if (entry.command.battleId !== battle.battleId) {
    throw new Error(
      `Battle command "${entry.command.battleId}" does not belong to battle "${battle.battleId}"`
    );
  }

  if (entry.command.action.type !== "run") {
    throw new Error(
      `Cannot resolve run attempt from action "${entry.command.action.type}"`
    );
  }

  const participant = battle.participants.find(
    (candidate) => candidate.id === entry.command.participantId
  );

  if (!participant) {
    throw new Error(
      `Battle participant "${entry.command.participantId}" not found in battle "${battle.battleId}"`
    );
  }

  if (participant.type !== "trainer") {
    throw new Error(
      `Battle participant "${participant.id}" cannot run because it is not a Trainer`
    );
  }

  const randomValue = random();

  if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
    throw new Error(`Invalid battle run random value "${randomValue}"`);
  }

  if (randomValue < BATTLE_RUN_SUCCESS_CHANCE) {
    return {
      type: "run-succeeded",
    };
  }

  return {
    type: "run-failed",
  };
}
