import { type PokemonInstanceMove } from "../pokemon.types.js";
import { MAX_POKEMON_MOVE_SLOTS } from "../pokemon.types.js";

import type { PokemonLevelUpMoveCandidate } from "./pokemon-level-up-moves.js";

export type PokemonMoveLearningSkipReason = "already-known";

export type PokemonMoveLearningResolution =
  | {
      readonly type: "skip";
      readonly reason: PokemonMoveLearningSkipReason;
      readonly candidate: PokemonLevelUpMoveCandidate;
      readonly nextMoves: readonly PokemonInstanceMove[];
    }
  | {
      readonly type: "auto-learn";
      readonly candidate: PokemonLevelUpMoveCandidate;
      readonly learnedMove: PokemonInstanceMove;
      readonly nextMoves: readonly PokemonInstanceMove[];
    }
  | {
      readonly type: "pending-decision";
      readonly candidate: PokemonLevelUpMoveCandidate;
      readonly currentMoves: readonly PokemonInstanceMove[];
    };

export interface ResolvePokemonMoveLearningCandidateInput {
  readonly candidate: PokemonLevelUpMoveCandidate;
  readonly currentMoves: readonly PokemonInstanceMove[];
}

export function resolvePokemonMoveLearningCandidate(
  input: ResolvePokemonMoveLearningCandidateInput,
): PokemonMoveLearningResolution {
  const { candidate, currentMoves } = input;

  assertValidCurrentMoves(currentMoves);

  /*
   * Do not rely only on candidate.alreadyKnown.
   *
   * currentMoves may have changed after resolving
   * a previous candidate in the same level-up sequence.
   */
  const alreadyKnown = currentMoves.some(
    (move) => move.moveId === candidate.moveId,
  );

  if (alreadyKnown) {
    return {
      type: "skip",
      reason: "already-known",
      candidate,
      nextMoves: cloneMoves(currentMoves),
    };
  }

  /*
   * Fewer than four moves:
   *
   * Learn automatically at full PP.
   */
  if (currentMoves.length < MAX_POKEMON_MOVE_SLOTS) {
    const learnedMove: PokemonInstanceMove = {
      moveId: candidate.moveId,
      currentPp: candidate.move.pp ?? 0,
    };

    return {
      type: "auto-learn",
      candidate,
      learnedMove,
      nextMoves: [...cloneMoves(currentMoves), learnedMove],
    };
  }

  /*
   * Four moves:
   *
   * Never overwrite silently.
   * Server-side orchestration will later create
   * a pending move-learning decision.
   */
  return {
    type: "pending-decision",
    candidate,
    currentMoves: cloneMoves(currentMoves),
  };
}

function assertValidCurrentMoves(
  currentMoves: readonly PokemonInstanceMove[],
): void {
  if (currentMoves.length > MAX_POKEMON_MOVE_SLOTS) {
    throw new Error(
      `Pokémon cannot know more than ${MAX_POKEMON_MOVE_SLOTS} moves`,
    );
  }

  const moveIds = new Set<number>();

  for (const move of currentMoves) {
    if (!Number.isInteger(move.moveId) || move.moveId <= 0) {
      throw new Error(`Invalid Pokémon move id "${move.moveId}"`);
    }

    if (!Number.isInteger(move.currentPp) || move.currentPp < 0) {
      throw new Error(
        `Invalid current PP "${move.currentPp}" for move "${move.moveId}"`,
      );
    }

    if (moveIds.has(move.moveId)) {
      throw new Error(`Pokémon contains duplicate move "${move.moveId}"`);
    }

    moveIds.add(move.moveId);
  }
}

function cloneMoves(
  moves: readonly PokemonInstanceMove[],
): PokemonInstanceMove[] {
  return moves.map((move) => ({
    ...move,
  }));
}
