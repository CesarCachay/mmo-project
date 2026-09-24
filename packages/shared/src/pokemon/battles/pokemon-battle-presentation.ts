import type { BattleParticipantId } from "./pokemon-battle.types.js";
import { isPokemonItemId } from "../inventory/pokemon-inventory.js";
import type { PokemonItemId } from "../inventory/pokemon-inventory.js";
import type { PokemonInstanceMove } from "../pokemon.types.js";
import { isBattleMajorStatusCondition } from "./pokemon-battle-status.js";
import type { BattleMoveStatusCondition } from "./pokemon-battle-status-move.types.js";

// moves
export interface BattleMoveUsedEvent {
  readonly type: "move-used";
  readonly participantId: BattleParticipantId;
  readonly pokemonInstanceId: string;
  readonly moveId: number;
  /** Authoritative number of successful hits for standard multi-hit moves. */
  readonly hitCount?: number;
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

export interface BattleStatusInflictedEvent {
  readonly type: "status-inflicted";
  readonly participantId: BattleParticipantId;
  readonly pokemonInstanceId: string;
  readonly status: BattleMoveStatusCondition;
  readonly sourceParticipantId: BattleParticipantId;
  readonly sourcePokemonInstanceId: string;
  readonly moveId: number;
}


export interface BattleStatusClearedEvent {
  readonly type: "status-cleared";
  readonly participantId: BattleParticipantId;
  readonly pokemonInstanceId: string;
  readonly status: BattleMoveStatusCondition;
}

export interface BattleStatusActionPreventedEvent {
  readonly type: "status-action-prevented";
  readonly participantId: BattleParticipantId;
  readonly pokemonInstanceId: string;
  readonly status: "sleep" | "freeze" | "paralysis";
}

export interface BattleConfusionSelfDamageEvent {
  readonly type: "confusion-self-damage";
  readonly participantId: BattleParticipantId;
  readonly pokemonInstanceId: string;
  readonly previousHp: number;
  readonly currentHp: number;
  readonly appliedDamage: number;
}

export interface BattleStatusResidualDamageEvent {
  readonly type: "status-residual-damage";
  readonly participantId: BattleParticipantId;
  readonly pokemonInstanceId: string;
  readonly status: "burn" | "poison" | "badly-poisoned";
  readonly previousHp: number;
  readonly currentHp: number;
  readonly appliedDamage: number;
  readonly toxicCounter?: number;
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

// progression
export interface BattleExperienceGainedEvent {
  readonly type: "experience-gained";
  readonly participantId: BattleParticipantId;
  readonly pokemonInstanceId: string;
  readonly gainedExperience: number;
  readonly previousExperience: number;
  readonly currentExperience: number;
  readonly previousLevel: number;
  readonly currentLevel: number;
}

export interface BattlePokemonLeveledUpEvent {
  readonly type: "pokemon-leveled-up";
  readonly participantId: BattleParticipantId;
  readonly pokemonInstanceId: string;
  readonly previousLevel: number;
  readonly currentLevel: number;
}

export interface BattleMoveLearningRequiredEvent {
  readonly type: "move-learning-required";
  readonly participantId: BattleParticipantId;
  readonly pokemonInstanceId: string;
  readonly candidateMoveId: number;
  readonly candidateLearnedAtLevel: number;
  readonly revision: number;
  readonly currentMoves: readonly PokemonInstanceMove[];
}

export interface BattleMoveLearnedEvent {
  readonly type: "move-learned";
  readonly participantId: BattleParticipantId;
  readonly pokemonInstanceId: string;
  readonly moveId: number;
}

export interface BattleEvolutionRequiredEvent {
  readonly type: "evolution-required";

  readonly participantId: BattleParticipantId;
  readonly pokemonInstanceId: string;

  readonly sourceSpeciesId: number;
  readonly sourceFormId: number;

  readonly targetSpeciesId: number;
  readonly targetFormId: number;

  readonly triggerLevel: number;
  readonly revision: number;
}

export type BattlePresentationEvent =
  | BattleMoveUsedEvent
  | BattleMoveMissedEvent
  | BattleDamageAppliedEvent
  | BattleStatusInflictedEvent
  | BattleStatusClearedEvent
  | BattleStatusActionPreventedEvent
  | BattleConfusionSelfDamageEvent
  | BattleStatusResidualDamageEvent
  | BattlePokemonFaintedEvent
  | BattlePokemonSwitchedEvent
  | BattleRunFailedEvent
  | BattleRunSucceededEvent
  | BattleItemUsedEvent
  | BattleHpRestoredEvent
  | BattleCaptureFailedPresentationEvent
  | BattleCaptureSucceededPresentationEvent
  | BattleExperienceGainedEvent
  | BattlePokemonLeveledUpEvent
  | BattleMoveLearningRequiredEvent
  | BattleMoveLearnedEvent
  | BattleEvolutionRequiredEvent;

function isMoveEvent(value: Record<string, unknown>): boolean {
  return (
    isNonEmptyString(value.participantId) &&
    isNonEmptyString(value.pokemonInstanceId) &&
    isPositiveInteger(value.moveId)
  );
}

function isMoveUsedEvent(value: Record<string, unknown>): boolean {
  return (
    isMoveEvent(value) &&
    (value.hitCount === undefined ||
      (isPositiveInteger(value.hitCount) && (value.hitCount as number) <= 10))
  );
}

function isStatusInflictedEvent(value: Record<string, unknown>): boolean {
  return (
    isNonEmptyString(value.participantId) &&
    isNonEmptyString(value.pokemonInstanceId) &&
    (value.status === "confusion" || isBattleMajorStatusCondition(value.status)) &&
    isNonEmptyString(value.sourceParticipantId) &&
    isNonEmptyString(value.sourcePokemonInstanceId) &&
    isPositiveInteger(value.moveId)
  );
}

function isStatusClearedEvent(value: Record<string, unknown>): boolean {
  return (
    isNonEmptyString(value.participantId) &&
    isNonEmptyString(value.pokemonInstanceId) &&
    (value.status === "confusion" || isBattleMajorStatusCondition(value.status))
  );
}

function isStatusActionPreventedEvent(
  value: Record<string, unknown>,
): boolean {
  return (
    isNonEmptyString(value.participantId) &&
    isNonEmptyString(value.pokemonInstanceId) &&
    (value.status === "sleep" ||
      value.status === "freeze" ||
      value.status === "paralysis")
  );
}

function isConfusionSelfDamageEvent(
  value: Record<string, unknown>,
): boolean {
  if (
    !isNonEmptyString(value.participantId) ||
    !isNonEmptyString(value.pokemonInstanceId) ||
    !isNonNegativeInteger(value.previousHp) ||
    !isNonNegativeInteger(value.currentHp) ||
    !isPositiveInteger(value.appliedDamage)
  ) {
    return false;
  }

  if (value.currentHp >= value.previousHp) {
    return false;
  }

  return value.appliedDamage === value.previousHp - value.currentHp;
}

function isStatusResidualDamageEvent(
  value: Record<string, unknown>,
): boolean {
  if (
    !isNonEmptyString(value.participantId) ||
    !isNonEmptyString(value.pokemonInstanceId) ||
    (value.status !== "burn" &&
      value.status !== "poison" &&
      value.status !== "badly-poisoned") ||
    !isNonNegativeInteger(value.previousHp) ||
    !isNonNegativeInteger(value.currentHp) ||
    !isPositiveInteger(value.appliedDamage)
  ) {
    return false;
  }

  if (value.currentHp >= value.previousHp) {
    return false;
  }

  if (
    value.status === "badly-poisoned" &&
    !isPositiveInteger(value.toxicCounter)
  ) {
    return false;
  }

  if (
    value.status !== "badly-poisoned" &&
    value.toxicCounter !== undefined
  ) {
    return false;
  }

  return value.appliedDamage === value.previousHp - value.currentHp;
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

export function isBattlePresentationEvent(
  value: unknown,
): value is BattlePresentationEvent {
  if (!isRecord(value)) {
    return false;
  }

  switch (value.type) {
    case "move-used":
      return isMoveUsedEvent(value);

    case "move-missed":
      return isMoveEvent(value);

    case "damage-applied":
      return isDamageAppliedEvent(value);

    case "status-inflicted":
      return isStatusInflictedEvent(value);

    case "status-cleared":
      return isStatusClearedEvent(value);

    case "status-action-prevented":
      return isStatusActionPreventedEvent(value);

    case "confusion-self-damage":
      return isConfusionSelfDamageEvent(value);

    case "status-residual-damage":
      return isStatusResidualDamageEvent(value);

    case "pokemon-fainted":
      return (
        isNonEmptyString(value.participantId) &&
        isNonEmptyString(value.pokemonInstanceId)
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

    case "experience-gained":
      return isExperienceGainedEvent(value);

    case "pokemon-leveled-up":
      return isPokemonLeveledUpEvent(value);

    case "move-learned":
      return isMoveLearnedEvent(value);

    case "move-learning-required":
      return isMoveLearningRequiredEvent(value);

    case "evolution-required":
      return isEvolutionRequiredEvent(value);

    default:
      return false;
  }
}

function isExperienceGainedEvent(value: Record<string, unknown>): boolean {
  if (
    !isNonEmptyString(value.participantId) ||
    !isNonEmptyString(value.pokemonInstanceId) ||
    !isPositiveInteger(value.gainedExperience) ||
    !isNonNegativeInteger(value.previousExperience) ||
    !isNonNegativeInteger(value.currentExperience) ||
    !isPositiveInteger(value.previousLevel) ||
    !isPositiveInteger(value.currentLevel)
  ) {
    return false;
  }

  const previousLevel = value.previousLevel as number;

  const currentLevel = value.currentLevel as number;

  const previousExperience = value.previousExperience as number;

  const currentExperience = value.currentExperience as number;

  if (previousLevel > 100 || currentLevel > 100) {
    return false;
  }

  if (currentLevel < previousLevel) {
    return false;
  }

  return currentExperience >= previousExperience;
}

function isPokemonLeveledUpEvent(value: Record<string, unknown>): boolean {
  if (
    !isNonEmptyString(value.participantId) ||
    !isNonEmptyString(value.pokemonInstanceId) ||
    !isPositiveInteger(value.previousLevel) ||
    !isPositiveInteger(value.currentLevel)
  ) {
    return false;
  }

  if (
    (value.previousLevel as number) > 100 ||
    (value.currentLevel as number) > 100
  ) {
    return false;
  }

  return (value.currentLevel as number) > (value.previousLevel as number);
}

function isMoveLearnedEvent(value: Record<string, unknown>): boolean {
  return (
    isNonEmptyString(value.participantId) &&
    isNonEmptyString(value.pokemonInstanceId) &&
    isPositiveInteger(value.moveId)
  );
}

function isMoveLearningRequiredEvent(value: Record<string, unknown>): boolean {
  return (
    isNonEmptyString(value.participantId) &&
    isNonEmptyString(value.pokemonInstanceId) &&
    isPositiveInteger(value.candidateMoveId) &&
    isPositiveInteger(value.candidateLearnedAtLevel) &&
    isNonNegativeInteger(value.revision) &&
    Array.isArray(value.currentMoves) &&
    value.currentMoves.length === 4
  );
}

function isEvolutionRequiredEvent(value: Record<string, unknown>): boolean {
  return (
    isNonEmptyString(value.participantId) &&
    isNonEmptyString(value.pokemonInstanceId) &&
    isPositiveInteger(value.sourceSpeciesId) &&
    isPositiveInteger(value.sourceFormId) &&
    isPositiveInteger(value.targetSpeciesId) &&
    isPositiveInteger(value.targetFormId) &&
    isPositiveInteger(value.triggerLevel) &&
    isNonNegativeInteger(value.revision)
  );
}
