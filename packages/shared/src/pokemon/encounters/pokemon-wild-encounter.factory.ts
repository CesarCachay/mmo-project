import { POKEMON_ENCOUNTER_TABLES } from "./pokemon-encounter-table.registry.js";
import { selectWeightedEncounterEntry } from "./pokemon-encounter-selection.js";
import { rollPokemonEncounterLevel } from "./pokemon-encounter-level.js";
import { createPokemonInstance } from "../pokemon-instance.factory.js";

import type { PokemonEncounterRng } from "./pokemon-encounter-selection.js";
import type { PokemonEncounterTableId } from "./pokemon-encounter-table.registry.js";
import type { WildPokemonEncounter } from "./pokemon-encounter.types.js";

export function createWildPokemonEncounter(
  zoneId: string,
  encounterTableId: PokemonEncounterTableId,
  rng: PokemonEncounterRng = Math.random
): WildPokemonEncounter {
  if (typeof zoneId !== "string" || zoneId.trim().length === 0) {
    throw new Error("Wild Pokémon encounter requires a non-empty zoneId");
  }

  const table = POKEMON_ENCOUNTER_TABLES[encounterTableId];

  if (!table) {
    throw new Error(`Pokémon encounter table "${encounterTableId}" was not found`);
  }

  const entry = selectWeightedEncounterEntry(table, rng);
  const level = rollPokemonEncounterLevel(entry, rng);
  const pokemon = createPokemonInstance(entry.speciesId, level);

  if (entry.formId !== undefined && pokemon.formId !== entry.formId) {
    throw new Error(
      `Encounter requested form ${entry.formId} for species ${entry.speciesId}, but PokemonInstanceFactory created form ${pokemon.formId}`
    );
  }

  return {
    zoneId: zoneId.trim(),
    encounterTableId,
    pokemon,
  };
}
