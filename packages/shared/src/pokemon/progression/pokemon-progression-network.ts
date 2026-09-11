import type { PokemonInstanceMove } from "../pokemon.types.js";

import type { PokemonMoveLearningDecision } from "./pokemon-move-learning-decision.js";

import {
  isPokemonEvolutionPresentation,
  type PokemonEvolutionPresentation,
} from "../evolution/pokemon-evolution-presentation.js";

export interface PokemonPendingMoveLearningNetworkState {
  readonly pokemonInstanceId: string;
  readonly candidateMoveId: number;
  readonly candidateLearnedAtLevel: number;
  readonly revision: number;
  readonly currentMoves: readonly PokemonInstanceMove[];
}

export interface PokemonMoveLearningDecisionInput {
  readonly pokemonInstanceId: string;
  readonly candidateMoveId: number;
  readonly revision: number;
  readonly decision: PokemonMoveLearningDecision;
}

export interface PokemonMoveLearningResolvedPayload {
  readonly pokemonInstanceId: string;
  readonly resolvedCandidateMoveId: number;
  readonly resolvedRevision: number;
  readonly decision: PokemonMoveLearningDecision;
  readonly currentMoves: readonly PokemonInstanceMove[];
  readonly nextPending: PokemonPendingMoveLearningNetworkState | null;
}

export interface PokemonMoveLearningErrorPayload {
  readonly pokemonInstanceId: string | null;
  readonly revision: number | null;
  readonly code: string;
  readonly message: string;
}

export interface PokemonEvolutionResolvedPayload extends PokemonEvolutionPresentation {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isPokemonMoveLearningDecision(
  value: unknown,
): value is PokemonMoveLearningDecision {
  if (!isRecord(value)) {
    return false;
  }

  if (value.type === "cancel") {
    return true;
  }

  return value.type === "forget" && isPositiveInteger(value.moveId);
}

function isPokemonInstanceMove(value: unknown): value is PokemonInstanceMove {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isPositiveInteger(value.moveId) && isNonNegativeInteger(value.currentPp)
  );
}

function isPendingState(
  value: unknown,
): value is PokemonPendingMoveLearningNetworkState {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.pokemonInstanceId === "string" &&
    value.pokemonInstanceId.trim().length > 0 &&
    isPositiveInteger(value.candidateMoveId) &&
    isPositiveInteger(value.candidateLearnedAtLevel) &&
    isNonNegativeInteger(value.revision) &&
    Array.isArray(value.currentMoves) &&
    value.currentMoves.length === 4 &&
    value.currentMoves.every(isPokemonInstanceMove)
  );
}

export function isPokemonMoveLearningDecisionInput(
  value: unknown,
): value is PokemonMoveLearningDecisionInput {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.pokemonInstanceId === "string" &&
    value.pokemonInstanceId.trim().length > 0 &&
    isPositiveInteger(value.candidateMoveId) &&
    isNonNegativeInteger(value.revision) &&
    isPokemonMoveLearningDecision(value.decision)
  );
}

export function isPokemonMoveLearningResolvedPayload(
  value: unknown,
): value is PokemonMoveLearningResolvedPayload {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.pokemonInstanceId === "string" &&
    value.pokemonInstanceId.trim().length > 0 &&
    isPositiveInteger(value.resolvedCandidateMoveId) &&
    isNonNegativeInteger(value.resolvedRevision) &&
    isPokemonMoveLearningDecision(value.decision) &&
    Array.isArray(value.currentMoves) &&
    value.currentMoves.every(isPokemonInstanceMove) &&
    (value.nextPending === null || isPendingState(value.nextPending))
  );
}

export function isPokemonMoveLearningErrorPayload(
  value: unknown,
): value is PokemonMoveLearningErrorPayload {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (value.pokemonInstanceId === null ||
      (typeof value.pokemonInstanceId === "string" &&
        value.pokemonInstanceId.trim().length > 0)) &&
    (value.revision === null || isNonNegativeInteger(value.revision)) &&
    typeof value.code === "string" &&
    typeof value.message === "string"
  );
}

export function isPokemonEvolutionResolvedPayload(
  value: unknown,
): value is PokemonEvolutionResolvedPayload {
  return isPokemonEvolutionPresentation(value);
}
