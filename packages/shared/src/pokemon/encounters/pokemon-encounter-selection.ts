import type {
  PokemonEncounterEntry,
  PokemonEncounterTable,
} from "./pokemon-encounter.types.js";

export type PokemonEncounterRng = () => number;

/**
 * Selects one encounter entry using relative weights.
 * The RNG must return a finite number in the range:
 * 0 <= value < 1
 * Injecting the RNG keeps this function deterministic and testable.
 */
export function selectWeightedEncounterEntry(
  table: PokemonEncounterTable,
  rng: PokemonEncounterRng = Math.random
): PokemonEncounterEntry {
  if (table.entries.length === 0) {
    throw new Error(`Encounter table "${table.id}" must contain at least one entry`);
  }

  let totalWeight = 0;

  for (const entry of table.entries) {
    if (!Number.isFinite(entry.weight) || entry.weight <= 0) {
      throw new Error(
        `Encounter table "${table.id}" contains invalid weight "${entry.weight}" for species ${entry.speciesId}`
      );
    }

    totalWeight += entry.weight;
  }

  if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
    throw new Error(`Encounter table "${table.id}" has an invalid total weight`);
  }

  const randomValue = rng();

  if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
    throw new Error(
      `Encounter RNG must return a finite value >= 0 and < 1. Received: ${randomValue}`
    );
  }

  const roll = randomValue * totalWeight;

  let cumulativeWeight = 0;

  for (const entry of table.entries) {
    cumulativeWeight += entry.weight;

    if (roll < cumulativeWeight) {
      return entry;
    }
  }

  /**
   * This should be unreachable because:
   *
   * rng < 1
   * roll < totalWeight
   *
   * Keeping an explicit failure is preferable to silently returning
   * an incorrect encounter if the algorithm changes in the future.
   */
  throw new Error(`Failed to select an encounter entry from table "${table.id}"`);
}
