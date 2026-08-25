import type { PokemonTrainerState } from "./pokemon.types.js";

export const POKEMON_EVENTS = {
  TRAINER_STATE: "pokemon:trainer-state",
} as const;

export interface PokemonTrainerStatePayload {
  trainerState: PokemonTrainerState;
}
