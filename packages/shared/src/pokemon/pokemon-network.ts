import type { PokemonTrainerState } from "./pokemon.types.js";
import type { PokemonEncounterTableId } from "./encounters/pokemon-encounter-table.registry.js";

import { PokemonInstance } from "./pokemon.types.js";

import { BattleInstance } from "./battles/pokemon-battle.types.js";

import { isPokemonBattleStartedPayload } from "./battles/pokemon-battle-network.js";

import { POKEMON_ENCOUNTER_TABLES } from "./encounters/pokemon-encounter-table.registry.js";

export const POKEMON_EVENTS = {
  TRAINER_STATE: "pokemon:trainer-state",
  CHOOSE_STARTER: "pokemon:choose-starter",

  STARTER_SELECTION_STATUS: "pokemon:starter-selection-status",

  TRAINER_SESSION: "pokemon:trainer-session",

  WILD_ENCOUNTER_STARTED: "pokemon:wild-encounter-started",

  BATTLE_STARTED: "pokemon:battle-started",
  BATTLE_COMMAND: "pokemon:battle-command",

  BATTLE_REPLACEMENT: "pokemon:battle-replacement",
  BATTLE_REPLACEMENT_RESOLVED: "pokemon:battle-replacement-resolved",
  BATTLE_COMPLETED: "pokemon:battle-completed",

  BATTLE_STATE_UPDATED: "pokemon:battle-state-updated",

  BATTLE_TURN_RESOLVED: "battleTurnResolved",
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

export interface PokemonBattleReplacementInput {
  readonly battleId: string;
  readonly replacementPokemonIndex: number;
}

export interface PokemonBattleReplacementResolvedPayload {
  readonly battle: BattleInstance;
  readonly nextTurnNumber: number;
}

export function isPokemonBattleReplacementInput(
  value: unknown
): value is PokemonBattleReplacementInput {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  if (typeof candidate.battleId !== "string" || candidate.battleId.trim().length === 0) {
    return false;
  }

  if (
    typeof candidate.replacementPokemonIndex !== "number" ||
    !Number.isInteger(candidate.replacementPokemonIndex) ||
    candidate.replacementPokemonIndex < 0
  ) {
    return false;
  }

  return true;
}

export function isPokemonBattleReplacementResolvedPayload(
  value: unknown
): value is PokemonBattleReplacementResolvedPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  if (
    typeof candidate.nextTurnNumber !== "number" ||
    !Number.isInteger(candidate.nextTurnNumber) ||
    candidate.nextTurnNumber <= 0
  ) {
    return false;
  }

  return isPokemonBattleStartedPayload({
    battle: candidate.battle,
  });
}

export type PokemonBattleCompletedOutcome =
  "trainer-defeated" | "wild-defeated" | "trainer-escaped" | "wild-captured";

export interface PokemonBattleCompletedPayload {
  readonly battleId: string;
  readonly outcome: PokemonBattleCompletedOutcome;
}

export function isPokemonBattleCompletedPayload(
  value: unknown
): value is PokemonBattleCompletedPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  if (typeof candidate.battleId !== "string" || candidate.battleId.trim().length === 0) {
    return false;
  }

  if (
    candidate.outcome !== "trainer-defeated" &&
    candidate.outcome !== "wild-defeated" &&
    candidate.outcome !== "trainer-escaped" &&
    candidate.outcome !== "wild-captured"
  ) {
    return false;
  }

  return true;
}

export type PokemonBattleInteractionState = "selecting-action" | "replacement-required";

export interface PokemonBattleStateUpdatedPayload {
  readonly battle: BattleInstance;
  readonly resolvedTurnNumber: number;
  readonly interactionState: PokemonBattleInteractionState;
  readonly nextTurnNumber: number | null;
  readonly replacementPokemonIndexes: readonly number[];
}

export function isPokemonBattleStateUpdatedPayload(
  value: unknown
): value is PokemonBattleStateUpdatedPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<PokemonBattleStateUpdatedPayload>;

  if (
    !candidate.battle ||
    typeof candidate.resolvedTurnNumber !== "number" ||
    !Number.isInteger(candidate.resolvedTurnNumber) ||
    candidate.resolvedTurnNumber < 1
  ) {
    return false;
  }

  if (
    candidate.interactionState !== "selecting-action" &&
    candidate.interactionState !== "replacement-required"
  ) {
    return false;
  }

  if (
    candidate.nextTurnNumber !== null &&
    (typeof candidate.nextTurnNumber !== "number" ||
      !Number.isInteger(candidate.nextTurnNumber) ||
      candidate.nextTurnNumber < 1)
  ) {
    return false;
  }

  if (
    !Array.isArray(candidate.replacementPokemonIndexes) ||
    !candidate.replacementPokemonIndexes.every(
      (index) => Number.isInteger(index) && index >= 0
    )
  ) {
    return false;
  }

  return true;
}
