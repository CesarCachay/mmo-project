import type { PokemonInstanceMove } from "../pokemon.types.js";

import { resolvePokemonMoveLearningCandidate } from "./pokemon-move-learning.js";

import type { PokemonMoveLearningResolution } from "./pokemon-move-learning.js";

import type { PokemonLevelUpMoveCandidate } from "./pokemon-level-up-moves.js";

import type { PokemonPendingMoveLearningResolution } from "./pokemon-move-learning-decision.js";

export interface PlanPokemonMoveLearningSequenceInput {
  readonly currentMoves: readonly PokemonInstanceMove[];
  readonly candidates: readonly PokemonLevelUpMoveCandidate[];
}

export type PokemonMoveLearningSequenceResult =
  | {
      readonly status: "complete";
      readonly resolutions: readonly PokemonMoveLearningResolution[];
      readonly currentMoves: readonly PokemonInstanceMove[];
      readonly pendingDecision: null;
      readonly remainingCandidates: readonly [];
    }
  | {
      readonly status: "pending-decision";
      readonly resolutions: readonly PokemonMoveLearningResolution[];
      readonly currentMoves: readonly PokemonInstanceMove[];
      readonly pendingDecision: PokemonPendingMoveLearningResolution;
      readonly remainingCandidates: readonly PokemonLevelUpMoveCandidate[];
    };

export function planPokemonMoveLearningSequence(
  input: PlanPokemonMoveLearningSequenceInput,
): PokemonMoveLearningSequenceResult {
  let currentMoves = cloneMoves(input.currentMoves);

  const resolutions: PokemonMoveLearningResolution[] = [];

  for (
    let candidateIndex = 0;
    candidateIndex < input.candidates.length;
    candidateIndex += 1
  ) {
    const candidate = input.candidates[candidateIndex];

    if (!candidate) {
      continue;
    }

    const resolution = resolvePokemonMoveLearningCandidate({
      candidate,
      currentMoves,
    });

    resolutions.push(resolution);

    switch (resolution.type) {
      case "skip": {
        currentMoves = cloneMoves(resolution.nextMoves);
        break;
      }

      case "auto-learn": {
        currentMoves = cloneMoves(resolution.nextMoves);
        break;
      }

      case "pending-decision": {
        const remainingCandidates = input.candidates
          .slice(candidateIndex + 1)
          .map((entry) => ({
            ...entry,
          }));

        return {
          status: "pending-decision",
          resolutions,
          currentMoves: cloneMoves(resolution.currentMoves),
          pendingDecision: resolution,
          remainingCandidates,
        };
      }

      default: {
        return assertNever(resolution);
      }
    }
  }

  return {
    status: "complete",
    resolutions,
    currentMoves,
    pendingDecision: null,
    remainingCandidates: [],
  };
}

function cloneMoves(
  moves: readonly PokemonInstanceMove[],
): PokemonInstanceMove[] {
  return moves.map((move) => ({
    ...move,
  }));
}

function assertNever(value: never): never {
  throw new Error(
    `Unsupported Pokémon move-learning resolution "${String(value)}"`,
  );
}
