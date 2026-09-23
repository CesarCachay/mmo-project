import type {
  PokemonGymBadgeDefinition,
  PokemonGymBadgeId,
  PokemonGymDefinition,
  PokemonGymId,
} from "./pokemon-gym.types.js";

export const POKEMON_GYM_BADGE_REGISTRY = {
  "boulder-badge": {
    id: "boulder-badge",
    displayName: "Boulder Badge",
  },
  "cascade-badge": {
    id: "cascade-badge",
    displayName: "Cascade Badge",
  },
} as const satisfies Record<PokemonGymBadgeId, PokemonGymBadgeDefinition>;

export const POKEMON_GYM_REGISTRY = {
  "gym-01": {
    id: "gym-01",
    mapId: "gym-01",
    displayName: "StoneBridge Gym",
    leaderTrainerBattleId: "gym-leader-brock",
    leaderPresentationId: "brock",
    badgeId: "boulder-badge",
  },
  "gym-02": {
    id: "gym-02",
    mapId: "gym-02",
    displayName: "AzureWave Gym",
    leaderTrainerBattleId: "gym-leader-misty",
    leaderPresentationId: "misty",
    badgeId: "cascade-badge",
  },
} as const satisfies Record<PokemonGymId, PokemonGymDefinition>;

export function isPokemonGymId(value: unknown): value is PokemonGymId {
  return typeof value === "string" && value in POKEMON_GYM_REGISTRY;
}

export function isPokemonGymBadgeId(value: unknown): value is PokemonGymBadgeId {
  return typeof value === "string" && value in POKEMON_GYM_BADGE_REGISTRY;
}

export function getPokemonGymDefinition(gymId: PokemonGymId): PokemonGymDefinition {
  return POKEMON_GYM_REGISTRY[gymId];
}

export function getPokemonGymBadgeDefinition(
  badgeId: PokemonGymBadgeId,
): PokemonGymBadgeDefinition {
  return POKEMON_GYM_BADGE_REGISTRY[badgeId];
}
