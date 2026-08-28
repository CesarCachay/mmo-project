import type { PokemonTrainerState } from "./pokemon.types.js";

export const POKEMON_EVENTS = {
  TRAINER_STATE: "pokemon:trainer-state",
  CHOOSE_STARTER: "pokemon:choose-starter",

  STARTER_SELECTION_STATUS: "pokemon:starter-selection-status",

  TRAINER_SESSION: "pokemon:trainer-session",
} as const;

export interface PokemonTrainerStatePayload {
  trainerState: PokemonTrainerState;
}

export interface PokemonStarterSelectionStatus {
  unlocked: boolean;
}

export interface PokemonTrainerSessionPayload {
  sessionToken: string;
}
