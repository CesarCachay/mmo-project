export interface CalculateWildBattleExperienceRewardInput {
  readonly baseExperience: number;
  readonly defeatedPokemonLevel: number;
}

export interface PokemonWildBattleExperienceReward {
  readonly baseExperience: number;
  readonly defeatedPokemonLevel: number;
  readonly experience: number;
}

/*
 * Progression V1.
 *
 * Wild Battle EXP:
 *
 * floor(baseExperience * defeatedLevel / 7)
 *
 * The formula is deliberately isolated here so future
 * balancing does not affect Battle runtime or Progression.
 */
export function calculateWildBattleExperienceReward(
  input: CalculateWildBattleExperienceRewardInput,
): PokemonWildBattleExperienceReward {
  const { baseExperience, defeatedPokemonLevel } = input;

  if (!Number.isInteger(baseExperience) || baseExperience <= 0) {
    throw new Error(
      `Pokémon base experience must be a positive integer. Received "${baseExperience}"`,
    );
  }

  if (
    !Number.isInteger(defeatedPokemonLevel) ||
    defeatedPokemonLevel < 1 ||
    defeatedPokemonLevel > 100
  ) {
    throw new Error(
      `Defeated Pokémon level must be between 1 and 100. Received "${defeatedPokemonLevel}"`,
    );
  }

  const experience = Math.max(
    1,
    Math.floor((baseExperience * defeatedPokemonLevel) / 7),
  );

  return {
    baseExperience,
    defeatedPokemonLevel,
    experience,
  };
}
