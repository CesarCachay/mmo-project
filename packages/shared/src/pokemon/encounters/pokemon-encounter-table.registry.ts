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
        minLevel: 8,
        maxLevel: 10,
        weight: 1,
      },
      {
        speciesId: 30, // Nidorina
        minLevel: 7,
        maxLevel: 11,
        weight: 1,
      },
      {
        speciesId: 92, // Gastly
        minLevel: 7,
        maxLevel: 10,
        weight: 1,
      },
      {
        speciesId: 77, // Ponyta
        minLevel: 7,
        maxLevel: 11,
        weight: 1,
      },
      {
        speciesId: 74, // Geodude
        minLevel: 8,
        maxLevel: 12,
        weight: 1,
      },
    ],
  },
  "mixed-town-02": {
    id: "mixed-town-02",
    entries: [
      {
        speciesId: 23, // Ekans
        minLevel: 8,
        maxLevel: 10,
        weight: 1,
      },
      {
        speciesId: 27, // Sandshrew
        minLevel: 7,
        maxLevel: 11,
        weight: 1,
      },
      {
        speciesId: 137, // Tauros
        minLevel: 8,
        maxLevel: 12,
        weight: 1,
      },
      {
        speciesId: 43, // Meowth
        minLevel: 7,
        maxLevel: 11,
        weight: 1,
      },
      {
        speciesId: 43, // Oddish
        minLevel: 8,
        maxLevel: 10,
        weight: 1,
      },
    ],
  },
  "route-03-grass": {
    id: "route-03-grass",
    entries: [
      { speciesId: 17, minLevel: 17, maxLevel: 20, weight: 2 }, // Pidgeotto
      { speciesId: 43, minLevel: 17, maxLevel: 20, weight: 2 }, // Oddish
      { speciesId: 69, minLevel: 18, maxLevel: 21, weight: 2 }, // Bellsprout
      { speciesId: 52, minLevel: 18, maxLevel: 21, weight: 1 }, // Meowth
      { speciesId: 54, minLevel: 19, maxLevel: 21, weight: 1 }, // Psyduck
    ],
  },
} as const satisfies Record<string, PokemonEncounterTable>;

export type PokemonEncounterTableId = keyof typeof POKEMON_ENCOUNTER_TABLES;
