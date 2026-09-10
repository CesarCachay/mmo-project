export const POKEMON_GROWTH_RATES = [
  "slow",
  "medium-slow",
  "medium",
  "fast",
  "erratic",
  "fluctuating",
] as const;

export type PokemonGrowthRate = (typeof POKEMON_GROWTH_RATES)[number];

const POKEMON_GROWTH_RATE_SET: ReadonlySet<string> = new Set(
  POKEMON_GROWTH_RATES,
);

export function isPokemonGrowthRate(
  value: unknown,
): value is PokemonGrowthRate {
  return typeof value === "string" && POKEMON_GROWTH_RATE_SET.has(value);
}
