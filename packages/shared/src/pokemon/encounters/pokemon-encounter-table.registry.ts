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
  "mixed-town-01": {
    id: "mixed-town-01",
    entries: [
      {
        speciesId: 33, // Nidorino
        minLevel: 4,
        maxLevel: 8,
        weight: 1,
      },
      {
        speciesId: 30, // Nidorina
        minLevel: 4,
        maxLevel: 7,
        weight: 1,
      },
      {
        speciesId: 92, // Gastly
        minLevel: 2,
        maxLevel: 4,
        weight: 1,
      },
      {
        speciesId: 77, // Ponyta
        minLevel: 3,
        maxLevel: 7,
        weight: 1,
      },
      {
        speciesId: 74, // Geodude
        minLevel: 4,
        maxLevel: 8,
        weight: 1,
      },
    ],
  },
  "mixed-town-02": {
    id: "mixed-town-02",
    entries: [
      {
        speciesId: 23, // Ekans
        minLevel: 4,
        maxLevel: 8,
        weight: 1,
      },
      {
        speciesId: 27, // Sandshrew
        minLevel: 4,
        maxLevel: 7,
        weight: 1,
      },
      {
        speciesId: 137, // Tauros
        minLevel: 2,
        maxLevel: 4,
        weight: 1,
      },
      {
        speciesId: 43, // Meowth
        minLevel: 3,
        maxLevel: 7,
        weight: 1,
      },
      {
        speciesId: 43, // Oddish
        minLevel: 4,
        maxLevel: 8,
        weight: 1,
      },
    ],
  },
} as const satisfies Record<string, PokemonEncounterTable>;

export type PokemonEncounterTableId = keyof typeof POKEMON_ENCOUNTER_TABLES;
