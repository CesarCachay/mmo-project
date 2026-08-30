import type { PokemonTrainerState } from "./pokemon.types.js";
import type { PokemonEncounterTableId } from "./encounters/pokemon-encounter-table.registry.js";

import { PokemonInstance } from "./pokemon.types.js";

import { POKEMON_ENCOUNTER_TABLES } from "./encounters/pokemon-encounter-table.registry.js";

export const POKEMON_EVENTS = {
  TRAINER_STATE: "pokemon:trainer-state",
  CHOOSE_STARTER: "pokemon:choose-starter",

  STARTER_SELECTION_STATUS: "pokemon:starter-selection-status",

  TRAINER_SESSION: "pokemon:trainer-session",

  WILD_ENCOUNTER_STARTED: "pokemon:wild-encounter-started",
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

export interface PokemonWildEncounterStartedPayload {
  readonly encounterId: string;
  readonly zoneId: string;
  readonly encounterTableId: PokemonEncounterTableId;
  readonly pokemon: PokemonInstance;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPokemonEncounterTableId(value: unknown): value is PokemonEncounterTableId {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(POKEMON_ENCOUNTER_TABLES, value)
  );
}

function isPokemonInstanceMove(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Number.isInteger(value.moveId) &&
    Number(value.moveId) > 0 &&
    Number.isInteger(value.currentPp) &&
    Number(value.currentPp) >= 0
  );
}

function isPokemonInstance(value: unknown): value is PokemonInstance {
  if (!isRecord(value)) {
    return false;
  }

  if (typeof value.instanceId !== "string" || value.instanceId.length === 0) {
    return false;
  }

  if (!Number.isInteger(value.speciesId) || Number(value.speciesId) <= 0) {
    return false;
  }

  if (!Number.isInteger(value.formId) || Number(value.formId) <= 0) {
    return false;
  }

  if (value.nickname !== undefined && typeof value.nickname !== "string") {
    return false;
  }

  if (!Number.isInteger(value.level) || Number(value.level) <= 0) {
    return false;
  }

  if (!Number.isInteger(value.experience) || Number(value.experience) < 0) {
    return false;
  }

  if (!Number.isInteger(value.currentHp) || Number(value.currentHp) < 0) {
    return false;
  }

  if (!Number.isInteger(value.abilityId) || Number(value.abilityId) <= 0) {
    return false;
  }

  if (
    !Array.isArray(value.moves) ||
    value.moves.length > 4 ||
    !value.moves.every(isPokemonInstanceMove)
  ) {
    return false;
  }

  return true;
}

export function isPokemonWildEncounterStartedPayload(
  value: unknown
): value is PokemonWildEncounterStartedPayload {
  if (!isRecord(value)) {
    return false;
  }

  if (typeof value.encounterId !== "string" || value.encounterId.length === 0) {
    return false;
  }

  if (typeof value.zoneId !== "string" || value.zoneId.length === 0) {
    return false;
  }

  if (!isPokemonEncounterTableId(value.encounterTableId)) {
    return false;
  }

  return isPokemonInstance(value.pokemon);
}
