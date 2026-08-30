import type { PokemonEncounterEntry } from "./pokemon-encounter.types.js";
import type { PokemonEncounterRng } from "./pokemon-encounter-selection.js";

/**
 * Rolls an inclusive Pokémon level for an encounter entry.
 * Example: minLevel = 3 y maxLevel = 5
 * possible results: 3, 4, 5
 */
export function rollPokemonEncounterLevel(
  entry: PokemonEncounterEntry,
  rng: PokemonEncounterRng = Math.random
): number {
  const { minLevel, maxLevel } = entry;

  if (!Number.isInteger(minLevel) || minLevel <= 0) {
    throw new Error(
      `Encounter minLevel must be a positive integer. Received: ${minLevel}`
    );
  }

  if (!Number.isInteger(maxLevel) || maxLevel < minLevel) {
    throw new Error(
      `Encounter maxLevel must be an integer >= minLevel. Received: ${maxLevel}`
    );
  }

  const randomValue = rng();

  if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
    throw new Error(
      `Encounter RNG must return a finite value >= 0 and < 1. Received: ${randomValue}`
    );
  }

  const levelRange = maxLevel - minLevel + 1;

  return minLevel + Math.floor(randomValue * levelRange);
}
