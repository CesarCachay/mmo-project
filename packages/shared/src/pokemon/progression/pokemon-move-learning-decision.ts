import {
  MAX_POKEMON_MOVE_SLOTS,
  type PokemonInstanceMove,
} from "../pokemon.types.js";

import type { PokemonMoveLearningResolution } from "./pokemon-move-learning.js";

import type { PokemonLevelUpMoveCandidate } from "./pokemon-level-up-moves.js";

export type PokemonPendingMoveLearningResolution = Extract<
  PokemonMoveLearningResolution,
  {
    readonly type: "pending-decision";
  }
>;

export type PokemonMoveLearningDecision =
  | {
      readonly type: "forget";
      readonly moveId: number;
    }
  | {
      readonly type: "cancel";
    };

export type PokemonMoveLearningDecisionResult =
  | {
      readonly type: "learned-after-forget";
      readonly candidate: PokemonLevelUpMoveCandidate;
      readonly forgottenMove: PokemonInstanceMove;
      readonly learnedMove: PokemonInstanceMove;
      readonly replacedMoveIndex: number;
      readonly nextMoves: readonly PokemonInstanceMove[];
    }
  | {
      readonly type: "cancelled";
      readonly candidate: PokemonLevelUpMoveCandidate;
      readonly nextMoves: readonly PokemonInstanceMove[];
    };

export interface ResolvePokemonMoveLearningDecisionInput {
  readonly pending: PokemonPendingMoveLearningResolution;
  readonly decision: PokemonMoveLearningDecision;
}

export function resolvePokemonMoveLearningDecision(
  input: ResolvePokemonMoveLearningDecisionInput,
): PokemonMoveLearningDecisionResult {
  const { pending, decision } = input;

  assertValidPendingResolution(pending);

  if (decision.type === "cancel") {
    return {
      type: "cancelled",
      candidate: pending.candidate,
      nextMoves: cloneMoves(pending.currentMoves),
    };
  }

  const replacedMoveIndex = pending.currentMoves.findIndex(
    (move) => move.moveId === decision.moveId,
  );

  if (replacedMoveIndex === -1) {
    throw new Error(
      `Cannot forget move "${decision.moveId}" because the Pokémon does not currently know it`,
    );
  }

  const forgottenMove = pending.currentMoves[replacedMoveIndex];

  if (!forgottenMove) {
    throw new Error(
      `Move learning replacement slot "${replacedMoveIndex}" could not be resolved`,
    );
  }

  /*
   * New level-up moves start with full PP.
   *
   * This follows the same policy currently used when
   * PokemonInstanceFactory creates initial moves.
   */
  const learnedMove: PokemonInstanceMove = {
    moveId: pending.candidate.moveId,
    currentPp: pending.candidate.move.pp ?? 0,
  };

  const nextMoves = cloneMoves(pending.currentMoves);

  /*
   * Preserve exact move slot/order.
   *
   * If slot 1 is forgotten,
   * the new move occupies slot 1.
   */
  nextMoves[replacedMoveIndex] = learnedMove;

  return {
    type: "learned-after-forget",
    candidate: pending.candidate,
    forgottenMove: {
      ...forgottenMove,
    },
    learnedMove,
    replacedMoveIndex,
    nextMoves,
  };
}

function assertValidPendingResolution(
  pending: PokemonPendingMoveLearningResolution,
): void {
  if (pending.currentMoves.length !== MAX_POKEMON_MOVE_SLOTS) {
    throw new Error(
      [
        "Pending Pokémon move-learning decision",
        `requires exactly ${MAX_POKEMON_MOVE_SLOTS} current moves`,
        `received ${pending.currentMoves.length}`,
      ].join(" "),
    );
  }

  const knownMoveIds = new Set<number>();

  for (const move of pending.currentMoves) {
    if (!Number.isInteger(move.moveId) || move.moveId <= 0) {
      throw new Error(`Invalid Pokémon move id "${move.moveId}"`);
    }

    if (!Number.isInteger(move.currentPp) || move.currentPp < 0) {
      throw new Error(
        `Invalid current PP "${move.currentPp}" for move "${move.moveId}"`,
      );
    }

    if (knownMoveIds.has(move.moveId)) {
      throw new Error(`Pokémon contains duplicate move "${move.moveId}"`);
    }

    knownMoveIds.add(move.moveId);
  }

  if (knownMoveIds.has(pending.candidate.moveId)) {
    throw new Error(
      `Pending move "${pending.candidate.moveId}" is already known by the Pokémon`,
    );
  }
}

function cloneMoves(
  moves: readonly PokemonInstanceMove[],
): PokemonInstanceMove[] {
  return moves.map((move) => ({
    ...move,
  }));
}
