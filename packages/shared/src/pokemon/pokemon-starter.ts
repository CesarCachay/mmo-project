export const POKEMON_STARTERS = {
  BULBASAUR: {
    speciesId: 1,
    level: 5,
  },

  CHARMANDER: {
    speciesId: 4,
    level: 5,
  },

  SQUIRTLE: {
    speciesId: 7,
    level: 5,
  },

  CHIKORITA: {
    speciesId: 152,
    level: 5,
  },

  CYNDAQUIL: {
    speciesId: 155,
    level: 5,
  },

  TOTODILE: {
    speciesId: 158,
    level: 5,
  },

  TREECKO: {
    speciesId: 252,
    level: 5,
  },

  TORCHIC: {
    speciesId: 255,
    level: 5,
  },

  MUDKIP: {
    speciesId: 258,
    level: 5,
  },

  TURTWIG: {
    speciesId: 387,
    level: 5,
  },

  CHIMCHAR: {
    speciesId: 390,
    level: 5,
  },

  PIPLUP: {
    speciesId: 393,
    level: 5,
  },
} as const;

export type PokemonStarterId = keyof typeof POKEMON_STARTERS;

export interface PokemonStarterChoiceInput {
  starterId: PokemonStarterId;
}

export function isPokemonStarterId(value: unknown): value is PokemonStarterId {
  return typeof value === "string" && value in POKEMON_STARTERS;
}
export function isPokemonStarterChoiceInput(
  value: unknown,
): value is PokemonStarterChoiceInput {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return isPokemonStarterId(record.starterId);
}
