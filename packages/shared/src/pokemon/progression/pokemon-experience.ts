import type { PokemonGrowthRate } from "./pokemon-growth-rate.js";

export const MIN_POKEMON_LEVEL = 1;
export const MAX_POKEMON_LEVEL = 100;

export function getExperienceForLevel(
  growthRate: PokemonGrowthRate,
  level: number,
): number {
  assertValidPokemonLevel(level);

  if (level === MIN_POKEMON_LEVEL) {
    return 0;
  }

  const levelCubed = level ** 3;

  switch (growthRate) {
    case "fast":
      return Math.floor((4 * levelCubed) / 5);

    case "medium":
      return levelCubed;

    case "medium-slow":
      return Math.floor(
        (6 * levelCubed) / 5 - 15 * level ** 2 + 100 * level - 140,
      );

    case "slow":
      return Math.floor((5 * levelCubed) / 4);

    case "erratic":
      return calculateErraticExperience(level);

    case "fluctuating":
      return calculateFluctuatingExperience(level);

    default:
      return assertNever(growthRate);
  }
}

export function getLevelFromExperience(
  growthRate: PokemonGrowthRate,
  experience: number,
): number {
  assertValidExperience(experience);

  for (let level = MAX_POKEMON_LEVEL; level >= MIN_POKEMON_LEVEL; level -= 1) {
    if (experience >= getExperienceForLevel(growthRate, level)) {
      return level;
    }
  }

  return MIN_POKEMON_LEVEL;
}

export function getExperienceToNextLevel(
  growthRate: PokemonGrowthRate,
  level: number,
  currentExperience: number,
): number {
  assertValidPokemonLevel(level);
  assertValidExperience(currentExperience);

  if (level >= MAX_POKEMON_LEVEL) {
    return 0;
  }

  const nextLevelExperience = getExperienceForLevel(growthRate, level + 1);

  return Math.max(0, nextLevelExperience - currentExperience);
}

function calculateErraticExperience(level: number): number {
  const levelCubed = level ** 3;

  if (level < 50) {
    return Math.floor((levelCubed * (100 - level)) / 50);
  }

  if (level < 68) {
    return Math.floor((levelCubed * (150 - level)) / 100);
  }

  if (level < 98) {
    const factor = Math.floor((1911 - 10 * level) / 3);

    return Math.floor((levelCubed * factor) / 500);
  }

  return Math.floor((levelCubed * (160 - level)) / 100);
}

function calculateFluctuatingExperience(level: number): number {
  const levelCubed = level ** 3;

  if (level < 15) {
    const factor = Math.floor((level + 1) / 3) + 24;

    return Math.floor((levelCubed * factor) / 50);
  }

  if (level < 36) {
    return Math.floor((levelCubed * (level + 14)) / 50);
  }

  const factor = Math.floor(level / 2) + 32;

  return Math.floor((levelCubed * factor) / 50);
}

function assertValidPokemonLevel(level: number): void {
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

function assertValidExperience(experience: number): void {
  if (!Number.isInteger(experience) || experience < 0) {
    throw new Error(
      `Pokémon experience must be a non-negative integer. Received: ${experience}`,
    );
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported Pokémon growth rate "${String(value)}"`);
}
