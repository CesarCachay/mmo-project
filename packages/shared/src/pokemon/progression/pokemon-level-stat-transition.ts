import { calculatePokemonDerivedStats } from "../pokemon-stat.js";

import { MAX_POKEMON_LEVEL, MIN_POKEMON_LEVEL } from "./pokemon-experience.js";

import type { PokemonDerivedStats } from "../pokemon-stat.js";

import type { PokemonInstance } from "../pokemon.types.js";

export interface PlanPokemonLevelStatTransitionInput {
  readonly pokemon: Pick<
    PokemonInstance,
    "instanceId" | "speciesId" | "formId" | "level" | "currentHp"
  >;

  readonly newLevel: number;
}

export interface PokemonLevelStatTransition {
  readonly pokemonInstanceId: string;

  readonly previousLevel: number;
  readonly currentLevel: number;

  readonly previousStats: PokemonDerivedStats;
  readonly currentStats: PokemonDerivedStats;

  readonly previousHp: number;
  readonly currentHp: number;

  readonly maxHpIncrease: number;

  readonly wasFainted: boolean;
}

export function planPokemonLevelStatTransition(
  input: PlanPokemonLevelStatTransitionInput,
): PokemonLevelStatTransition {
  const { pokemon, newLevel } = input;

  assertValidTargetLevel(pokemon.level, newLevel);

  const previousStats = calculatePokemonDerivedStats(pokemon);

  assertValidCurrentHp(pokemon.currentHp, previousStats.maxHp);

  const currentStats = calculatePokemonDerivedStats({
    speciesId: pokemon.speciesId,
    formId: pokemon.formId,
    level: newLevel,
  });

  const maxHpIncrease = currentStats.maxHp - previousStats.maxHp;

  const wasFainted = pokemon.currentHp === 0;

  /*
   * Progression HP policy:
   *
   * Alive:
   * preserve the amount of HP missing.
   *
   * Example:
   *
   * old 80/100
   * new maxHp 103
   * => 83/103
   *
   * Fainted:
   * remains 0 HP.
   *
   * Level-up / Rare Candy never revives.
   */
  const currentHp = wasFainted
    ? 0
    : Math.min(currentStats.maxHp, pokemon.currentHp + maxHpIncrease);

  return {
    pokemonInstanceId: pokemon.instanceId,
    previousLevel: pokemon.level,
    currentLevel: newLevel,
    previousStats,
    currentStats,
    previousHp: pokemon.currentHp,
    currentHp,
    maxHpIncrease,
    wasFainted,
  };
}

function assertValidTargetLevel(previousLevel: number, newLevel: number): void {
  if (
    !Number.isInteger(previousLevel) ||
    previousLevel < MIN_POKEMON_LEVEL ||
    previousLevel > MAX_POKEMON_LEVEL
  ) {
    throw new Error(`Invalid previous Pokémon level "${previousLevel}"`);
  }

  if (
    !Number.isInteger(newLevel) ||
    newLevel < MIN_POKEMON_LEVEL ||
    newLevel > MAX_POKEMON_LEVEL
  ) {
    throw new Error(`Invalid target Pokémon level "${newLevel}"`);
  }

  if (newLevel < previousLevel) {
    throw new Error(
      `Pokémon level transition cannot decrease from ${previousLevel} to ${newLevel}`,
    );
  }
}

function assertValidCurrentHp(currentHp: number, maxHp: number): void {
  if (!Number.isInteger(currentHp) || currentHp < 0 || currentHp > maxHp) {
    throw new Error(
      `Invalid Pokémon current HP "${currentHp}" for max HP "${maxHp}"`,
    );
  }
}
