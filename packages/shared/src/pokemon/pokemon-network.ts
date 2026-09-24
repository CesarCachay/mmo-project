import type { PokemonTrainerState } from "./pokemon.types.js";
import type { PokemonEncounterTableId } from "./encounters/pokemon-encounter-table.registry.js";

import { PokemonInstance } from "./pokemon.types.js";

import { BattleInstance } from "./battles/pokemon-battle.types.js";

import {
  isPokemonBattleInstance,
  isPokemonBattleStartedPayload,
} from "./battles/pokemon-battle-network.js";

import { POKEMON_ENCOUNTER_TABLES } from "./encounters/pokemon-encounter-table.registry.js";

import { isPokemonItemId, type PokemonInventoryItemStack } from "./inventory/pokemon-inventory.js";
import { isPokemonStarterId } from "./pokemon-starter.js";
import { isPokemonMoney, type PokemonMoney } from "./economy/pokemon-money.js";
import {
  getPokemonGymBadgeDefinition,
  isPokemonGymBadgeId,
} from "./trainers/pokemon-gym.registry.js";
import type { PokemonGymBadgeId } from "./trainers/pokemon-gym.types.js";
import { isPokemonPersistentMajorStatusState } from "./pokemon-status.js";


export const POKEMON_EVENTS = {
  TRAINER_STATE: "pokemon:trainer-state",
  CHOOSE_STARTER: "pokemon:choose-starter",

  STARTER_SELECTION_STATUS: "pokemon:starter-selection-status",
  STARTER_SELECTED: "pokemon:starter-selected",

  WILD_ENCOUNTER_STARTED: "pokemon:wild-encounter-started",

  BATTLE_STARTED: "pokemon:battle-started",
  TRAINER_BATTLE_START: "pokemon:trainer-battle-start",
  BATTLE_COMMAND: "pokemon:battle-command",

  BATTLE_REPLACEMENT: "pokemon:battle-replacement",
  BATTLE_REPLACEMENT_RESOLVED: "pokemon:battle-replacement-resolved",
  BATTLE_COMPLETED: "pokemon:battle-completed",
  BLACKOUT_RECOVERY_REQUEST: "pokemon:blackout-recovery-request",

  BATTLE_STATE_UPDATED: "pokemon:battle-state-updated",
  BATTLE_TURN_RESOLVED: "battleTurnResolved",

  MOVE_LEARNING_DECISION: "pokemon:move-learning-decision",
  MOVE_LEARNING_RESOLVED: "pokemon:move-learning-resolved",
  MOVE_LEARNING_ERROR: "pokemon:move-learning-error",

  EVOLUTION_REQUIRED: "pokemon:evolution-required",
  EVOLUTION_DECISION: "pokemon:evolution-decision",
  EVOLUTION_RESOLVED: "pokemon:evolution-resolved",
  EVOLUTION_ERROR: "pokemon:evolution-error",

  STORAGE_OPEN: "pokemon:storage-open",
  STORAGE_CLOSE: "pokemon:storage-close",
  STORAGE_STATE: "pokemon:storage-state",
  STORAGE_COMMAND: "pokemon:storage-command",
  STORAGE_ERROR: "pokemon:storage-error",
} as const;

export interface PokemonTrainerStatePayload {
  trainerState: PokemonTrainerState;
}

export interface PokemonStarterSelectionStatus {
  unlocked: boolean;
}

export interface PokemonStarterSelectedPayload {
  readonly starterId: import("./pokemon-starter.js").PokemonStarterId;
  readonly rewardItems: readonly PokemonInventoryItemStack[];
}

export function isPokemonStarterSelectedPayload(
  value: unknown,
): value is PokemonStarterSelectedPayload {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isPokemonStarterId(value.starterId) &&
    Array.isArray(value.rewardItems) &&
    value.rewardItems.every(
      (item) =>
        isRecord(item) &&
        isPokemonItemId(item.itemId) &&
        Number.isInteger(item.quantity) &&
        Number(item.quantity) > 0,
    )
  );
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

function isPokemonEncounterTableId(
  value: unknown,
): value is PokemonEncounterTableId {
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
    value.majorStatus !== undefined &&
    !isPokemonPersistentMajorStatusState(value.majorStatus)
  ) {
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
  value: unknown,
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
  value: unknown,
): value is PokemonBattleReplacementInput {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  if (
    typeof candidate.battleId !== "string" ||
    candidate.battleId.trim().length === 0
  ) {
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
  value: unknown,
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

  return isPokemonBattleInstance(candidate.battle);
}

export type PokemonBattleCompletedOutcome =
  | "trainer-defeated"
  | "wild-defeated"
  | "trainer-escaped"
  | "wild-captured"
  | "trainer-battle-victory"
  | "trainer-battle-defeat";

export interface PokemonGymBadgeAward {
  readonly badgeId: PokemonGymBadgeId;
  readonly displayName: string;
}

export interface PokemonTrainerBattleCompletionRewards {
  /** Actual money credited after applying the wallet cap. */
  readonly money: PokemonMoney;
  readonly items: readonly PokemonInventoryItemStack[];
  /** Present only when a Gym badge was durably awarded on this victory. */
  readonly gymBadge?: PokemonGymBadgeAward;
}

export interface PokemonBattleCompletedPayload {
  readonly battleId: string;
  readonly outcome: PokemonBattleCompletedOutcome;
  readonly trainerBattleRewards?: PokemonTrainerBattleCompletionRewards;
}

export function isPokemonBattleCompletedPayload(
  value: unknown,
): value is PokemonBattleCompletedPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  if (
    typeof candidate.battleId !== "string" ||
    candidate.battleId.trim().length === 0
  ) {
    return false;
  }

  if (
    candidate.outcome !== "trainer-defeated" &&
    candidate.outcome !== "wild-defeated" &&
    candidate.outcome !== "trainer-escaped" &&
    candidate.outcome !== "wild-captured" &&
    candidate.outcome !== "trainer-battle-victory" &&
    candidate.outcome !== "trainer-battle-defeat"
  ) {
    return false;
  }

  if (candidate.trainerBattleRewards !== undefined) {
    if (candidate.outcome !== "trainer-battle-victory") {
      return false;
    }

    if (!isPokemonTrainerBattleCompletionRewards(candidate.trainerBattleRewards)) {
      return false;
    }
  }

  return true;
}

export function isPokemonTrainerBattleCompletionRewards(
  value: unknown,
): value is PokemonTrainerBattleCompletionRewards {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  if (!isPokemonMoney(candidate.money) || !Array.isArray(candidate.items)) {
    return false;
  }

  const seenItemIds = new Set<string>();

  for (const item of candidate.items) {
    if (typeof item !== "object" || item === null) {
      return false;
    }

    const stack = item as Record<string, unknown>;

    if (
      !isPokemonItemId(stack.itemId) ||
      !Number.isInteger(stack.quantity) ||
      (stack.quantity as number) <= 0 ||
      seenItemIds.has(stack.itemId)
    ) {
      return false;
    }

    seenItemIds.add(stack.itemId);
  }

  if (candidate.gymBadge !== undefined) {
    if (typeof candidate.gymBadge !== "object" || candidate.gymBadge === null) {
      return false;
    }

    const gymBadge = candidate.gymBadge as Record<string, unknown>;

    if (
      !isPokemonGymBadgeId(gymBadge.badgeId) ||
      typeof gymBadge.displayName !== "string" ||
      gymBadge.displayName !==
        getPokemonGymBadgeDefinition(gymBadge.badgeId).displayName
    ) {
      return false;
    }
  }

  return true;
}

export type PokemonBattleInteractionState =
  "selecting-action" | "replacement-required";

export interface PokemonBattleStateUpdatedPayload {
  readonly battle: BattleInstance;
  readonly resolvedTurnNumber: number;
  readonly interactionState: PokemonBattleInteractionState;
  readonly nextTurnNumber: number | null;
  readonly replacementPokemonIndexes: readonly number[];
}

export function isPokemonBattleStateUpdatedPayload(
  value: unknown,
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
      (index) => Number.isInteger(index) && index >= 0,
    )
  ) {
    return false;
  }

  return true;
}
