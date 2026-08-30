import type { PokemonInstance } from "../pokemon.types.js";
import type { PokemonEncounterTableId } from "./pokemon-encounter-table.registry.js";

export interface PokemonEncounterEntry {
  readonly speciesId: number;
  readonly formId?: number;
  readonly minLevel: number;
  readonly maxLevel: number;
  readonly weight: number;
}

export interface PokemonEncounterTable {
  /**
   * Stable logical identifier.
   * Example:
   * "town-grass"
   */
  readonly id: string;
  readonly entries: readonly PokemonEncounterEntry[];
}

export interface PokemonEncounterZone {
  readonly id: string;
  readonly encounterTableId: PokemonEncounterTableId;
}

export interface WildPokemonEncounter {
  readonly zoneId: string;
  readonly encounterTableId: string;
  readonly pokemon: PokemonInstance;
}
