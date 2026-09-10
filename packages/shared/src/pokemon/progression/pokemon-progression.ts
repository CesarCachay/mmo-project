import {
  planPokemonExperienceGain,
  type PokemonExperienceProgressionPlan,
} from "./pokemon-progression-plan.js";

import {
  planPokemonLevelStatTransition,
  type PokemonLevelStatTransition,
} from "./pokemon-level-stat-transition.js";

import {
  resolvePokemonLevelUpMoves,
  type PokemonLevelUpMoveCandidate,
} from "./pokemon-level-up-moves.js";

import {
  planPokemonMoveLearningSequence,
  type PokemonMoveLearningSequenceResult,
} from "./pokemon-move-learning-sequence.js";

import type { PokemonGrowthRate } from "./pokemon-growth-rate.js";

import type { PokemonInstance, PokemonInstanceMove } from "../pokemon.types.js";

export interface PlanPokemonProgressionInput {
  readonly pokemon: PokemonInstance;
  readonly growthRate: PokemonGrowthRate;
  readonly gainedExperience: number;
}

export interface PokemonProgressionPlan {
  readonly pokemonInstanceId: string;
  readonly experience: PokemonExperienceProgressionPlan;
  readonly stats: PokemonLevelStatTransition;
  readonly moveCandidates: readonly PokemonLevelUpMoveCandidate[];
  readonly moveLearning: PokemonMoveLearningSequenceResult;

  /*
   * Pokémon state that can be reached automatically
   * without requiring a player decision.
   *
   * If moveLearning.status === "pending-decision",
   * this contains all automatic changes up to the
   * first unresolved move candidate.
   */
  readonly automaticPokemonState: PokemonInstance;
  readonly requiresMoveLearningDecision: boolean;
}

export function planPokemonProgression(
  input: PlanPokemonProgressionInput,
): PokemonProgressionPlan {
  const { pokemon, growthRate, gainedExperience } = input;

  const experience = planPokemonExperienceGain({
    growthRate,
    currentLevel: pokemon.level,
    currentExperience: pokemon.experience,
    gainedExperience,
  });

  const stats = planPokemonLevelStatTransition({
    pokemon,
    newLevel: experience.currentLevel,
  });

  const moveCandidates = resolvePokemonLevelUpMoves({
    speciesId: pokemon.speciesId,
    crossedLevels: experience.crossedLevels,
    currentMoves: pokemon.moves,
  });

  const moveLearning = planPokemonMoveLearningSequence({
    currentMoves: pokemon.moves,
    candidates: moveCandidates,
  });

  const automaticPokemonState: PokemonInstance = {
    ...pokemon,
    level: experience.currentLevel,
    experience: experience.currentExperience,
    currentHp: stats.currentHp,
    moves: cloneMoves(moveLearning.currentMoves),
  };

  return {
    pokemonInstanceId: pokemon.instanceId,
    experience,
    stats,
    moveCandidates,
    moveLearning,
    automaticPokemonState,
    requiresMoveLearningDecision: moveLearning.status === "pending-decision",
  };
}

function cloneMoves(
  moves: readonly PokemonInstanceMove[],
): PokemonInstanceMove[] {
  return moves.map((move) => ({
    ...move,
  }));
}
