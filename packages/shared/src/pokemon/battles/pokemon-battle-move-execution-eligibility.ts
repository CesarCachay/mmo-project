import { isBattlePokemonAbleToAct } from "./pokemon-battle-faint.js";

import {
  getActiveBattlePokemon,
  getOpposingBattleParticipant,
} from "./pokemon-battle-participant.js";

import { isBattleActive } from "./pokemon-battle-lifecycle.js";

import type { BattleTurnResolutionEntry } from "./pokemon-battle-turn-order.js";

import type {
  BattleInstance,
  BattleParticipant,
  BattlePokemonState,
} from "./pokemon-battle.types.js";

export type BattleMoveExecutionSkipReason = "actor-fainted" | "target-fainted";

export type BattleMoveExecutionEligibility =
  | {
      readonly canExecute: true;
      readonly skipReason: null;
      readonly actorParticipant: BattleParticipant;
      readonly actorPokemon: BattlePokemonState;
    }
  | {
      readonly canExecute: false;
      readonly skipReason: BattleMoveExecutionSkipReason;
      readonly actorParticipant: BattleParticipant;
      readonly actorPokemon: BattlePokemonState;
    };

export function evaluateBattleMoveExecutionEligibility(
  battle: BattleInstance,
  entry: BattleTurnResolutionEntry
): BattleMoveExecutionEligibility {
  if (!isBattleActive(battle)) {
    throw new Error(
      `Cannot evaluate move execution eligibility for battle "${battle.battleId}" with status "${battle.status}"`
    );
  }

  if (entry.command.battleId !== battle.battleId) {
    throw new Error(
      `Battle command "${entry.command.battleId}" does not belong to battle "${battle.battleId}"`
    );
  }

  const actorParticipant = battle.participants.find(
    (participant) => participant.id === entry.command.participantId
  );

  if (!actorParticipant) {
    throw new Error(
      `Battle participant "${entry.command.participantId}" not found in battle "${battle.battleId}"`
    );
  }

  const actorPokemon = getActiveBattlePokemon(actorParticipant);

  if (!isBattlePokemonAbleToAct(actorPokemon)) {
    return {
      canExecute: false,
      skipReason: "actor-fainted",
      actorParticipant,
      actorPokemon,
    };
  }

  // A self-KO (for example confusion self-damage) can leave the opposing
  // command later in the same resolution order with no valid active target.
  // Skip that move rather than executing into a fainted Pokémon.
  const targetParticipant = getOpposingBattleParticipant(
    battle,
    actorParticipant.id,
  );
  const targetPokemon = getActiveBattlePokemon(targetParticipant);

  if (!isBattlePokemonAbleToAct(targetPokemon)) {
    return {
      canExecute: false,
      skipReason: "target-fainted",
      actorParticipant,
      actorPokemon,
    };
  }

  return {
    canExecute: true,
    skipReason: null,
    actorParticipant,
    actorPokemon,
  };
}
