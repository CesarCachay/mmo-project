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

import {
  evaluatePokemonLevelEvolution,
  type PokemonLevelEvolutionEvaluation,
} from "../evolution/pokemon-evolution-eligibility.js";

import {
  planPokemonEvolution,
  type PokemonEvolutionPlan,
} from "../evolution/pokemon-evolution-plan.js";

import type { PokemonGrowthRate } from "./pokemon-growth-rate.js";

import type { PokemonInstance, PokemonInstanceMove } from "../pokemon.types.js";

export interface PlanPokemonProgressionInput {
  readonly pokemon: PokemonInstance;
  readonly growthRate: PokemonGrowthRate;
  readonly gainedExperience: number;
}

export interface PokemonProgressionEvolutionResult {
  readonly evaluation: PokemonLevelEvolutionEvaluation;
  readonly plan: PokemonEvolutionPlan | null;
  readonly deferredByMoveLearning: boolean;
  readonly requiresDecision: boolean;
}

export interface PokemonProgressionPlan {
  readonly pokemonInstanceId: string;
  readonly experience: PokemonExperienceProgressionPlan;
  readonly stats: PokemonLevelStatTransition;
  readonly moveCandidates: readonly PokemonLevelUpMoveCandidate[];
  readonly moveLearning: PokemonMoveLearningSequenceResult;
  readonly evolution: PokemonProgressionEvolutionResult;

  /*
   * Final state that may be persisted automatically
   * without requiring another player decision.
   *
   * When Evolution is immediately applicable this is
   * already the evolved Pokémon.
   *
   * When Move Learning is pending this remains the
   * pre-evolution Pokémon.
   */
  readonly automaticPokemonState: PokemonInstance;

  readonly requiresMoveLearningDecision: boolean;
}

export function planPokemonProgression(
  input: PlanPokemonProgressionInput,
): PokemonProgressionPlan {
  const { pokemon, growthRate, gainedExperience } = input;

  /*
   * --------------------------------------------------
   * 1. Experience / Level
   * --------------------------------------------------
   */
  const experience = planPokemonExperienceGain({
    growthRate,
    currentLevel: pokemon.level,
    currentExperience: pokemon.experience,
    gainedExperience,
  });

  /*
   * --------------------------------------------------
   * 2. Level stat transition
   * --------------------------------------------------
   */
  const stats = planPokemonLevelStatTransition({
    pokemon,
    newLevel: experience.currentLevel,
  });

  /*
   * --------------------------------------------------
   * 3. Resolve moves using PRE-EVOLUTION species
   * --------------------------------------------------
   */
  const moveCandidates = resolvePokemonLevelUpMoves({
    speciesId: pokemon.speciesId,
    crossedLevels: experience.crossedLevels,
    currentMoves: pokemon.moves,
  });

  const moveLearning = planPokemonMoveLearningSequence({
    currentMoves: pokemon.moves,
    candidates: moveCandidates,
  });

  /*
   * State after EXP / Level / HP / automatic Move Learning,
   * but BEFORE Evolution.
   */
  const preEvolutionPokemonState: PokemonInstance = {
    ...pokemon,
    level: experience.currentLevel,
    experience: experience.currentExperience,
    currentHp: stats.currentHp,
    moves: cloneMoves(moveLearning.currentMoves),
  };

  const leveledUp = experience.currentLevel > experience.previousLevel;

  /*
   * --------------------------------------------------
   * 4. Evolution eligibility
   * --------------------------------------------------
   */
  const evolutionEvaluation = evaluatePokemonLevelEvolution({
    speciesId: preEvolutionPokemonState.speciesId,
    level: preEvolutionPokemonState.level,
  });

  /*
   * Move Learning always gets priority over Evolution.
   *
   * The final pending decision will trigger a fresh
   * Evolution evaluation in the server continuation.
   */
  const evolutionDeferredByMoveLearning =
    leveledUp &&
    moveLearning.status === "pending-decision" &&
    evolutionEvaluation.status === "eligible";

  /*
   * --------------------------------------------------
   * 5. Evolution transformation
   * --------------------------------------------------
   */
  const evolutionPlan =
    leveledUp &&
    evolutionEvaluation.status === "eligible" &&
    !evolutionDeferredByMoveLearning
      ? planPokemonEvolution({
          pokemon: preEvolutionPokemonState,
          candidate: evolutionEvaluation.candidate,
        })
      : null;

  /*
   * Evolution is now player-confirmed.
   * The planner may prepare the target transition,
   * but progression itself NEVER mutates species/form.
   */
  const automaticPokemonState = preEvolutionPokemonState;

  return {
    pokemonInstanceId: pokemon.instanceId,
    experience,
    stats,
    moveCandidates,
    moveLearning,
    evolution: {
      evaluation: evolutionEvaluation,
      plan: evolutionPlan,
      deferredByMoveLearning: evolutionDeferredByMoveLearning,
      requiresDecision: evolutionPlan !== null,
    },
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
