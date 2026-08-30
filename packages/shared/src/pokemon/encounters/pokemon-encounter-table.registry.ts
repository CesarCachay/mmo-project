import type { PokemonEncounterTable } from "./pokemon-encounter.types.js";

export const POKEMON_ENCOUNTER_TABLES = {
  "town-grass": {
    id: "town-grass",

    entries: [
      {
        speciesId: 19, // Rattata
        minLevel: 2,
        maxLevel: 4,
        weight: 1,
      },
      {
        speciesId: 16, // Pidgey
        minLevel: 2,
        maxLevel: 4,
        weight: 1,
      },
      {
        speciesId: 25, // Pikachu
        minLevel: 2,
        maxLevel: 4,
        weight: 1,
      },
    ],
  },
} as const satisfies Record<string, PokemonEncounterTable>;

export type PokemonEncounterTableId = keyof typeof POKEMON_ENCOUNTER_TABLES;
