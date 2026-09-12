import type { PokemonInstanceMove } from "../pokemon.types.js";

import type { PokemonMoveLearningDecision } from "./pokemon-move-learning-decision.js";

import {
  isPokemonEvolutionPresentation,
  type PokemonEvolutionPresentation,
} from "../evolution/pokemon-evolution-presentation.js";

import type { PokemonEvolutionDecision } from "../evolution/pokemon-evolution-decision.js";

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

  readonly pendingEvolution: PokemonEvolutionRequiredPayload | null;
}

export interface PokemonMoveLearningErrorPayload {
  readonly pokemonInstanceId: string | null;
  readonly revision: number | null;
  readonly code: string;
  readonly message: string;
}

export interface PokemonEvolutionRequiredPayload {
  readonly pokemonInstanceId: string;

  readonly sourceSpeciesId: number;
  readonly sourceFormId: number;

  readonly targetSpeciesId: number;
  readonly targetFormId: number;

  readonly triggerLevel: number;
  readonly revision: number;
}

export interface PokemonEvolutionDecisionInput {
  readonly pokemonInstanceId: string;
  readonly revision: number;
  readonly decision: PokemonEvolutionDecision;
}

export interface PokemonEvolutionResolvedPayload {
  readonly pokemonInstanceId: string;
  readonly resolvedRevision: number;
  readonly decision: PokemonEvolutionDecision;
  /*
   * ACCEPT:
   *   contains the completed source -> target transition.
   *
   * CANCEL:
   *   null because the Pokémon did not evolve.
   */
  readonly evolution: PokemonEvolutionPresentation | null;
}

export interface PokemonEvolutionErrorPayload {
  readonly pokemonInstanceId: string | null;
  readonly revision: number | null;
  readonly code: string;
  readonly message: string;
}

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

  /* Base payload */
  if (
    typeof value.pokemonInstanceId !== "string" ||
    value.pokemonInstanceId.trim().length === 0 ||
    !isPositiveInteger(value.resolvedCandidateMoveId) ||
    !isNonNegativeInteger(value.resolvedRevision) ||
    !isPokemonMoveLearningDecision(value.decision) ||
    !Array.isArray(value.currentMoves) ||
    !value.currentMoves.every(isPokemonInstanceMove)
  ) {
    return false;
  }

  /* At this point TypeScript knows this is string */
  const pokemonInstanceId = value.pokemonInstanceId;

  /* Next Move Learning */
  const nextPending = value.nextPending;

  if (nextPending !== null && !isPendingState(nextPending)) {
    return false;
  }

  /* Pending Evolution */
  const pendingEvolution = value.pendingEvolution;

  if (
    pendingEvolution !== null &&
    !isPokemonEvolutionRequiredPayload(pendingEvolution)
  ) {
    return false;
  }

  /*
   * Domain invariant
   *
   * The Pokémon cannot still require another
   * Move Learning decision and simultaneously
   * begin Evolution.
   */
  if (nextPending !== null && pendingEvolution !== null) {
    return false;
  }

  /*
   * Any continuation must belong to the exact
   * same Pokémon whose decision was resolved.
   */
  if (
    nextPending !== null &&
    nextPending.pokemonInstanceId !== pokemonInstanceId
  ) {
    return false;
  }

  if (
    pendingEvolution !== null &&
    pendingEvolution.pokemonInstanceId !== pokemonInstanceId
  ) {
    return false;
  }

  return true;
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

function isPokemonEvolutionDecision(
  value: unknown,
): value is PokemonEvolutionDecision {
  if (!isRecord(value)) {
    return false;
  }

  return value.type === "accept" || value.type === "cancel";
}

export function isPokemonEvolutionRequiredPayload(
  value: unknown,
): value is PokemonEvolutionRequiredPayload {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.pokemonInstanceId === "string" &&
    value.pokemonInstanceId.trim().length > 0 &&
    isPositiveInteger(value.sourceSpeciesId) &&
    isPositiveInteger(value.sourceFormId) &&
    isPositiveInteger(value.targetSpeciesId) &&
    isPositiveInteger(value.targetFormId) &&
    isPositiveInteger(value.triggerLevel) &&
    isNonNegativeInteger(value.revision)
  );
}

export function isPokemonEvolutionDecisionInput(
  value: unknown,
): value is PokemonEvolutionDecisionInput {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.pokemonInstanceId === "string" &&
    value.pokemonInstanceId.trim().length > 0 &&
    isNonNegativeInteger(value.revision) &&
    isPokemonEvolutionDecision(value.decision)
  );
}

export function isPokemonEvolutionResolvedPayload(
  value: unknown,
): value is PokemonEvolutionResolvedPayload {
  if (!isRecord(value)) {
    return false;
  }

  if (
    typeof value.pokemonInstanceId !== "string" ||
    value.pokemonInstanceId.trim().length === 0 ||
    !isNonNegativeInteger(value.resolvedRevision) ||
    !isPokemonEvolutionDecision(value.decision)
  ) {
    return false;
  }

  /* CANCEL never contains an Evolution presentation */
  if (value.decision.type === "cancel") {
    return value.evolution === null;
  }

  /*
   * ACCEPT must contain the authoritative completed
   * Evolution transition.
   */
  if (!isPokemonEvolutionPresentation(value.evolution)) {
    return false;
  }

  return value.evolution.pokemonInstanceId === value.pokemonInstanceId;
}

export function isPokemonEvolutionErrorPayload(
  value: unknown,
): value is PokemonEvolutionErrorPayload {
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
