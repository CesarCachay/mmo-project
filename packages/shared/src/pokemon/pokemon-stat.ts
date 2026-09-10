import { getPokemonForm } from "./pokemon-form.registry.js";

import type {
  PokemonBaseStats,
  PokemonInstance,
  PokemonForm,
} from "./pokemon.types.js";

export interface PokemonDerivedStats {
  readonly maxHp: number;
  readonly attack: number;
  readonly defense: number;
  readonly specialAttack: number;
  readonly specialDefense: number;
  readonly speed: number;
}

type PokemonStatSource = Pick<
  PokemonInstance,
  "speciesId" | "formId" | "level"
>;

export function calculatePokemonMaxHp(pokemon: PokemonStatSource): number {
  const form = resolvePokemonStatForm(pokemon);

  assertValidPokemonLevel(pokemon.level);

  return (
    Math.floor((2 * form.baseStats.hp * pokemon.level) / 100) +
    pokemon.level +
    10
  );
}

export function calculatePokemonNonHpStat(
  baseStat: number,
  level: number,
): number {
  if (!Number.isInteger(baseStat) || baseStat <= 0) {
    throw new Error(`Invalid Pokémon base stat "${baseStat}"`);
  }

  assertValidPokemonLevel(level);

  /*
   * Progression V1 uses the same simplified stat model
   * already established by Battle:
   *
   * - no IV
   * - no EV
   * - no Nature
   */
  return Math.floor((2 * baseStat * level) / 100) + 5;
}

export function calculatePokemonDerivedStats(
  pokemon: PokemonStatSource,
): PokemonDerivedStats {
  const form = resolvePokemonStatForm(pokemon);

  const baseStats: PokemonBaseStats = form.baseStats;

  return {
    maxHp: calculatePokemonMaxHp(pokemon),
    attack: calculatePokemonNonHpStat(baseStats.attack, pokemon.level),
    defense: calculatePokemonNonHpStat(baseStats.defense, pokemon.level),
    specialAttack: calculatePokemonNonHpStat(
      baseStats.specialAttack,
      pokemon.level,
    ),
    specialDefense: calculatePokemonNonHpStat(
      baseStats.specialDefense,
      pokemon.level,
    ),
    speed: calculatePokemonNonHpStat(baseStats.speed, pokemon.level),
  };
}

function resolvePokemonStatForm(
  pokemon: Pick<PokemonInstance, "speciesId" | "formId">,
): PokemonForm {
  const form = getPokemonForm(pokemon.formId);

  if (!form || form.speciesId !== pokemon.speciesId) {
    throw new Error(
      `Pokémon form "${pokemon.formId}" not found for species "${pokemon.speciesId}"`,
    );
  }

  return form;
}

function assertValidPokemonLevel(level: number): void {
  if (!Number.isInteger(level) || level <= 0) {
    throw new Error(
      `Invalid Pokémon level "${level}" while calculating Pokémon stats`,
    );
  }
}
