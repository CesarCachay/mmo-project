import type { BattleParticipantId } from "./pokemon-battle.types.js";
import { isPokemonItemId } from "../inventory/pokemon-inventory.js";
import type { PokemonItemId } from "../inventory/pokemon-inventory.js";

// moves
export interface BattleMoveUsedEvent {
  readonly type: "move-used";
  readonly participantId: BattleParticipantId;
  readonly pokemonInstanceId: string;
  readonly moveId: number;
}

export interface BattleMoveMissedEvent {
  readonly type: "move-missed";
  readonly participantId: BattleParticipantId;
  readonly pokemonInstanceId: string;
  readonly moveId: number;
}

export interface BattleDamageAppliedEvent {
  readonly type: "damage-applied";
  readonly participantId: BattleParticipantId;
  readonly pokemonInstanceId: string;
  readonly previousHp: number;
  readonly currentHp: number;
  readonly appliedDamage: number;

  /**
   * Authoritative type multiplier resolved by the server.
   *
   * Current Battle V1 examples:
   * 0, 0.25, 0.5, 1, 2, 4
   */
  readonly typeEffectiveness: number;
}

export interface BattlePokemonFaintedEvent {
  readonly type: "pokemon-fainted";
  readonly participantId: BattleParticipantId;
  readonly pokemonInstanceId: string;
}

export interface BattlePokemonSwitchedEvent {
  readonly type: "pokemon-switched";
  readonly participantId: BattleParticipantId;
  readonly previousActivePokemonIndex: number;
  readonly currentActivePokemonIndex: number;
  readonly previousPokemonInstanceId: string;
  readonly currentPokemonInstanceId: string;
}

// run
export interface BattleRunFailedEvent {
  readonly type: "run-failed";
  readonly participantId: BattleParticipantId;
}

export interface BattleRunSucceededEvent {
  readonly type: "run-succeeded";
  readonly participantId: BattleParticipantId;
}

// items
export interface BattleItemUsedEvent {
  readonly type: "item-used";
  readonly participantId: BattleParticipantId;
  readonly itemId: PokemonItemId;
  readonly targetPokemonInstanceId: string;
}

export interface BattleHpRestoredEvent {
  readonly type: "hp-restored";
  readonly participantId: BattleParticipantId;
  readonly pokemonInstanceId: string;
  readonly previousHp: number;
  readonly currentHp: number;
  readonly appliedHealing: number;
}

function isMoveEvent(value: Record<string, unknown>): boolean {
  return (
    isNonEmptyString(value.participantId) &&
    isNonEmptyString(value.pokemonInstanceId) &&
    isPositiveInteger(value.moveId)
  );
}

function isDamageAppliedEvent(value: Record<string, unknown>): boolean {
  if (
    !isNonEmptyString(value.participantId) ||
    !isNonEmptyString(value.pokemonInstanceId) ||
    !isNonNegativeInteger(value.previousHp) ||
    !isNonNegativeInteger(value.currentHp) ||
    !isNonNegativeInteger(value.appliedDamage) ||
    !isValidTypeEffectiveness(value.typeEffectiveness)
  ) {
    return false;
  }

  if (value.currentHp > value.previousHp) {
    return false;
  }

  return value.appliedDamage === value.previousHp - value.currentHp;
}

function isPokemonSwitchedEvent(value: Record<string, unknown>): boolean {
  if (
    !isNonEmptyString(value.participantId) ||
    !isNonNegativeInteger(value.previousActivePokemonIndex) ||
    !isNonNegativeInteger(value.currentActivePokemonIndex) ||
    !isNonEmptyString(value.previousPokemonInstanceId) ||
    !isNonEmptyString(value.currentPokemonInstanceId)
  ) {
    return false;
  }

  if (value.previousActivePokemonIndex === value.currentActivePokemonIndex) {
    return false;
  }

  return value.previousPokemonInstanceId !== value.currentPokemonInstanceId;
}

function isValidTypeEffectiveness(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isItemUsedEvent(value: Record<string, unknown>): boolean {
  return (
    isNonEmptyString(value.participantId) &&
    isPokemonItemId(value.itemId) &&
    isNonEmptyString(value.targetPokemonInstanceId)
  );
}

function isHpRestoredEvent(value: Record<string, unknown>): boolean {
  if (
    !isNonEmptyString(value.participantId) ||
    !isNonEmptyString(value.pokemonInstanceId) ||
    !isNonNegativeInteger(value.previousHp) ||
    !isNonNegativeInteger(value.currentHp) ||
    !isPositiveInteger(value.appliedHealing)
  ) {
    return false;
  }

  if (value.currentHp <= value.previousHp) {
    return false;
  }

  return value.appliedHealing === value.currentHp - value.previousHp;
}

// Capture
export interface BattleCaptureFailedPresentationEvent {
  readonly type: "capture-failed";
  readonly participantId: BattleParticipantId;
  readonly wildParticipantId: BattleParticipantId;
  readonly pokemonInstanceId: string;
  readonly itemId: PokemonItemId;
  readonly shakeCount: number;
}

export interface BattleCaptureSucceededPresentationEvent {
  readonly type: "capture-succeeded";
  readonly participantId: BattleParticipantId;
  readonly wildParticipantId: BattleParticipantId;
  readonly pokemonInstanceId: string;
  readonly itemId: PokemonItemId;
  readonly shakeCount: number;
}

function isCaptureFailedEvent(value: Record<string, unknown>): boolean {
  return (
    isNonEmptyString(value.participantId) &&
    isNonEmptyString(value.wildParticipantId) &&
    isNonEmptyString(value.pokemonInstanceId) &&
    isPokemonItemId(value.itemId) &&
    Number.isInteger(value.shakeCount) &&
    (value.shakeCount as number) >= 0 &&
    (value.shakeCount as number) <= 3
  );
}

function isCaptureSucceededEvent(value: Record<string, unknown>): boolean {
  return (
    isNonEmptyString(value.participantId) &&
    isNonEmptyString(value.wildParticipantId) &&
    isNonEmptyString(value.pokemonInstanceId) &&
    isPokemonItemId(value.itemId) &&
    value.shakeCount === 4
  );
}

export type BattlePresentationEvent =
  | BattleMoveUsedEvent
  | BattleMoveMissedEvent
  | BattleDamageAppliedEvent
  | BattlePokemonFaintedEvent
  | BattlePokemonSwitchedEvent
  | BattleRunFailedEvent
  | BattleRunSucceededEvent
  | BattleItemUsedEvent
  | BattleHpRestoredEvent
  | BattleCaptureFailedPresentationEvent
  | BattleCaptureSucceededPresentationEvent;

export function isBattlePresentationEvent(
  value: unknown
): value is BattlePresentationEvent {
  if (!isRecord(value)) {
    return false;
  }

  switch (value.type) {
    case "move-used":
      return isMoveEvent(value);

    case "move-missed":
      return isMoveEvent(value);

    case "damage-applied":
      return isDamageAppliedEvent(value);

    case "pokemon-fainted":
      return (
        isNonEmptyString(value.participantId) && isNonEmptyString(value.pokemonInstanceId)
      );

    case "pokemon-switched":
      return isPokemonSwitchedEvent(value);

    case "run-failed":
    case "run-succeeded":
      return isNonEmptyString(value.participantId);

    case "item-used":
      return isItemUsedEvent(value);

    case "hp-restored":
      return isHpRestoredEvent(value);

    case "capture-failed":
      return isCaptureFailedEvent(value);

    case "capture-succeeded":
      return isCaptureSucceededEvent(value);

    default:
      return false;
  }
}
