import {
  MAX_POKEMON_LEVEL,
  getExperienceForLevel,
  getLevelFromExperience,
} from "./pokemon-experience.js";

import { assertPokemonExperienceCompatibleWithLevel } from "./pokemon-progression-invariant.js";

import type { PokemonGrowthRate } from "./pokemon-growth-rate.js";

export interface PlanPokemonExperienceGainInput {
  readonly growthRate: PokemonGrowthRate;

  readonly currentLevel: number;
  readonly currentExperience: number;

  readonly gainedExperience: number;
}

export interface PokemonExperienceProgressionPlan {
  readonly previousLevel: number;
  readonly currentLevel: number;

  readonly previousExperience: number;
  readonly currentExperience: number;

  readonly requestedExperienceGain: number;
  readonly appliedExperienceGain: number;

  readonly crossedLevels: readonly number[];

  readonly leveledUp: boolean;
  readonly reachedLevelCap: boolean;
}

export function planPokemonExperienceGain(
  input: PlanPokemonExperienceGainInput,
): PokemonExperienceProgressionPlan {
  const { growthRate, currentLevel, currentExperience, gainedExperience } =
    input;

  assertPokemonExperienceCompatibleWithLevel(
    growthRate,
    currentLevel,
    currentExperience,
  );

  assertValidExperienceGain(gainedExperience);

  /*
   * Level 100:
   *
   * Progression V1 does not accumulate additional useful EXP
   * once the Pokémon has reached the level cap.
   */
  if (currentLevel >= MAX_POKEMON_LEVEL) {
    return {
      previousLevel: currentLevel,
      currentLevel,
      previousExperience: currentExperience,
      currentExperience,
      requestedExperienceGain: gainedExperience,
      appliedExperienceGain: 0,
      crossedLevels: [],
      leveledUp: false,
      reachedLevelCap: true,
    };
  }

  const maxExperience = getExperienceForLevel(growthRate, MAX_POKEMON_LEVEL);

  const requestedNextExperience = currentExperience + gainedExperience;

  /*
   * EXP itself is capped at the minimum EXP required for Lv.100.
   *
   * This prevents:
   *
   * Lv.100
   * EXP = 50,000,000
   */
  const nextExperience = Math.min(requestedNextExperience, maxExperience);

  const nextLevel = getLevelFromExperience(growthRate, nextExperience);

  const crossedLevels = resolveCrossedLevels(currentLevel, nextLevel);

  return {
    previousLevel: currentLevel,
    currentLevel: nextLevel,
    previousExperience: currentExperience,
    currentExperience: nextExperience,
    requestedExperienceGain: gainedExperience,
    appliedExperienceGain: nextExperience - currentExperience,
    crossedLevels,
    leveledUp: nextLevel > currentLevel,
    reachedLevelCap: nextLevel >= MAX_POKEMON_LEVEL,
  };
}

function resolveCrossedLevels(
  previousLevel: number,
  currentLevel: number,
): readonly number[] {
  if (currentLevel <= previousLevel) {
    return [];
  }

  const crossedLevels: number[] = [];

  for (let level = previousLevel + 1; level <= currentLevel; level += 1) {
    crossedLevels.push(level);
  }

  return crossedLevels;
}

function assertValidExperienceGain(gainedExperience: number): void {
  if (!Number.isInteger(gainedExperience) || gainedExperience < 0) {
    throw new Error(
      `Pokémon experience gain must be a non-negative integer. Received: ${gainedExperience}`,
    );
  }
}
