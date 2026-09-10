import {
  MAX_POKEMON_LEVEL,
  MIN_POKEMON_LEVEL,
  getExperienceForLevel,
} from "./pokemon-experience.js";

import type { PokemonGrowthRate } from "./pokemon-growth-rate.js";

export interface PokemonLevelExperienceRange {
  readonly level: number;
  readonly minimumExperience: number;
  readonly nextLevelExperience: number | null;
}

export function getPokemonLevelExperienceRange(
  growthRate: PokemonGrowthRate,
  level: number,
): PokemonLevelExperienceRange {
  assertValidLevel(level);

  const minimumExperience = getExperienceForLevel(growthRate, level);

  const nextLevelExperience =
    level >= MAX_POKEMON_LEVEL
      ? null
      : getExperienceForLevel(growthRate, level + 1);

  return {
    level,
    minimumExperience,
    nextLevelExperience,
  };
}

export function isPokemonExperienceCompatibleWithLevel(
  growthRate: PokemonGrowthRate,
  level: number,
  experience: number,
): boolean {
  if (!Number.isInteger(experience) || experience < 0) {
    return false;
  }

  const range = getPokemonLevelExperienceRange(growthRate, level);

  if (experience < range.minimumExperience) {
    return false;
  }

  if (
    range.nextLevelExperience !== null &&
    experience >= range.nextLevelExperience
  ) {
    return false;
  }

  return true;
}

export function assertPokemonExperienceCompatibleWithLevel(
  growthRate: PokemonGrowthRate,
  level: number,
  experience: number,
): void {
  if (isPokemonExperienceCompatibleWithLevel(growthRate, level, experience)) {
    return;
  }

  const range = getPokemonLevelExperienceRange(growthRate, level);

  throw new Error(
    [
      `Pokémon experience "${experience}" is incompatible with level "${level}"`,
      `growthRate="${growthRate}"`,
      `minimumExperience="${range.minimumExperience}"`,
      `nextLevelExperience="${String(range.nextLevelExperience)}"`,
    ].join(", "),
  );
}

function assertValidLevel(level: number): void {
  if (
    !Number.isInteger(level) ||
    level < MIN_POKEMON_LEVEL ||
    level > MAX_POKEMON_LEVEL
  ) {
    throw new Error(
      `Pokémon level must be an integer between ${MIN_POKEMON_LEVEL} and ${MAX_POKEMON_LEVEL}. Received: ${level}`,
    );
  }
}
