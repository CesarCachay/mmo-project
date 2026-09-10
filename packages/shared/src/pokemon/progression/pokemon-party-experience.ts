export const POKEMON_SHARED_EXPERIENCE_RATIO = 0.6;

export interface PokemonPartyExperienceSnapshot {
  readonly pokemonInstanceId: string;

  readonly level: number;

  /*
   * Must be authoritative Battle HP,
   * not stale persistent PokemonInstance.currentHp.
   */
  readonly currentHp: number;
}

export type PokemonPartyExperienceRewardReason =
  "participant" | "shared" | "fainted" | "level-cap";

export interface PokemonPartyExperienceReward {
  readonly pokemonInstanceId: string;

  readonly participated: boolean;

  readonly reason: PokemonPartyExperienceRewardReason;

  readonly gainedExperience: number;
}

export interface DistributePokemonPartyExperienceInput {
  readonly baseExperienceReward: number;

  readonly pokemon: readonly PokemonPartyExperienceSnapshot[];

  readonly participatingPokemonInstanceIds: readonly string[];
}

export interface PokemonPartyExperienceDistribution {
  readonly baseExperienceReward: number;

  readonly rewards: readonly PokemonPartyExperienceReward[];
}

export function distributePokemonPartyExperience(
  input: DistributePokemonPartyExperienceInput,
): PokemonPartyExperienceDistribution {
  const { baseExperienceReward, pokemon, participatingPokemonInstanceIds } =
    input;

  if (!Number.isInteger(baseExperienceReward) || baseExperienceReward < 0) {
    throw new Error(
      `Base Party experience reward must be a non-negative integer. Received "${baseExperienceReward}"`,
    );
  }

  const instanceIds = pokemon.map((entry) => entry.pokemonInstanceId);

  if (new Set(instanceIds).size !== instanceIds.length) {
    throw new Error(
      "Party experience snapshot contains duplicate Pokémon instance ids",
    );
  }

  const participatingIds = new Set(participatingPokemonInstanceIds);

  const rewards = pokemon.map((entry): PokemonPartyExperienceReward => {
    if (
      !Number.isInteger(entry.level) ||
      entry.level < 1 ||
      entry.level > 100
    ) {
      throw new Error(
        `Invalid Pokémon level "${entry.level}" for "${entry.pokemonInstanceId}"`,
      );
    }

    if (!Number.isInteger(entry.currentHp) || entry.currentHp < 0) {
      throw new Error(
        `Invalid current HP "${entry.currentHp}" for "${entry.pokemonInstanceId}"`,
      );
    }

    const participated = participatingIds.has(entry.pokemonInstanceId);

    /*
     * Battle-fainted Pokémon receive no EXP.
     */
    if (entry.currentHp <= 0) {
      return {
        pokemonInstanceId: entry.pokemonInstanceId,

        participated,

        reason: "fainted",

        gainedExperience: 0,
      };
    }

    /*
     * Lv.100 cannot gain additional EXP.
     */
    if (entry.level >= 100) {
      return {
        pokemonInstanceId: entry.pokemonInstanceId,

        participated,

        reason: "level-cap",

        gainedExperience: 0,
      };
    }

    /*
     * Participating Pokémon receive full reward.
     */
    if (participated) {
      return {
        pokemonInstanceId: entry.pokemonInstanceId,

        participated: true,

        reason: "participant",

        gainedExperience: baseExperienceReward,
      };
    }

    /*
     * Living Party Pokémon that did not participate
     * receive shared EXP.
     *
     * Reward pool is NOT divided by Party size.
     */
    return {
      pokemonInstanceId: entry.pokemonInstanceId,

      participated: false,

      reason: "shared",

      gainedExperience: Math.floor(
        baseExperienceReward * POKEMON_SHARED_EXPERIENCE_RATIO,
      ),
    };
  });

  return {
    baseExperienceReward,

    rewards,
  };
}
