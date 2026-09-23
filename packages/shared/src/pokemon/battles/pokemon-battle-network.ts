import type {
  BattleId,
  BattleInstance,
  BattleParticipant,
  BattleParticipantId,
  BattlePokemonState,
} from "./pokemon-battle.types.js";
import type { BattleCommandAction } from "./pokemon-battle-command.js";
import { isPokemonItemId } from "../inventory/pokemon-inventory.js";
import {
  getPokemonTrainerBattleDefinition,
  isPokemonTrainerBattleId,
  type PokemonTrainerBattleId,
} from "../trainers/pokemon-trainer-battle.registry.js";
import type {
  PokemonGymBadgeId,
  PokemonGymId,
  PokemonGymLeaderPresentationId,
} from "../trainers/pokemon-gym.types.js";

export interface PokemonWildBattlePresentationContext {
  readonly kind: "wild";
}

export interface PokemonStandardTrainerBattlePresentationContext {
  readonly kind: "trainer";
  readonly trainerBattleId: PokemonTrainerBattleId;
  readonly trainerClass: string;
}

export interface PokemonGymLeaderBattlePresentationContext {
  readonly kind: "gym-leader";
  readonly trainerBattleId: PokemonTrainerBattleId;
  readonly trainerClass: string;
  readonly gymId: PokemonGymId;
  readonly badgeId: PokemonGymBadgeId;
  readonly leaderPresentationId: PokemonGymLeaderPresentationId;
}

export type PokemonBattlePresentationContext =
  | PokemonWildBattlePresentationContext
  | PokemonStandardTrainerBattlePresentationContext
  | PokemonGymLeaderBattlePresentationContext;

export interface PokemonBattleStartedPayload {
  readonly battle: BattleInstance;
  readonly localParticipantId: BattleParticipantId;

  /**
   * Presentation-only metadata resolved by the server at battle start.
   * Optional for backwards compatibility with older reconnect payloads.
   * Battle rules must never depend on this field.
   */
  readonly presentation?: PokemonBattlePresentationContext;
}

export interface PokemonBattleCommandInput {
  readonly battleId: BattleId;
  readonly action: BattleCommandAction;
}

export function isPokemonBattleStartedPayload(
  value: unknown
): value is PokemonBattleStartedPayload {
  if (!isRecord(value)) {
    return false;
  }

  if (!isPokemonBattleInstance(value.battle)) {
    return false;
  }

  if (!isNonEmptyString(value.localParticipantId)) {
    return false;
  }

  if (
    value.presentation !== undefined &&
    !isPokemonBattlePresentationContext(value.presentation, value.battle)
  ) {
    return false;
  }

  const localParticipant = value.battle.participants.find(
    (participant) => participant.id === value.localParticipantId
  );

  if (!localParticipant || localParticipant.type !== "trainer") {
    return false;
  }

  // A BATTLE_STARTED event must describe an active battle.
  return value.battle.status === "active";
}

export function isPokemonBattleInstance(value: unknown): value is BattleInstance {
  if (!isRecord(value)) {
    return false;
  }

  if (!isNonEmptyString(value.battleId)) {
    return false;
  }

  if (value.type !== "wild" && value.type !== "trainer") {
    return false;
  }

  if (value.status !== "active" && value.status !== "completed") {
    return false;
  }

  if (!Array.isArray(value.participants)) {
    return false;
  }

  if (value.participants.length !== 2) {
    return false;
  }

  if (!value.participants.every(isBattleParticipant)) {
    return false;
  }

  const trainerParticipants = value.participants.filter(
    (participant) => participant.type === "trainer"
  );

  const wildParticipants = value.participants.filter(
    (participant) => participant.type === "wild"
  );

  if (value.type === "wild") {
    if (trainerParticipants.length !== 1 || wildParticipants.length !== 1) {
      return false;
    }
  } else {
    if (trainerParticipants.length !== 2 || wildParticipants.length !== 0) {
      return false;
    }
  }

  const sideA = value.participants.filter((participant) => participant.side === "side-a");

  const sideB = value.participants.filter((participant) => participant.side === "side-b");

  if (sideA.length !== 1 || sideB.length !== 1) {
    return false;
  }

  const participantIds = new Set(value.participants.map((participant) => participant.id));

  return participantIds.size === value.participants.length;
}

function isPokemonBattlePresentationContext(
  value: unknown,
  battle: BattleInstance
): value is PokemonBattlePresentationContext {
  if (!isRecord(value) || !isNonEmptyString(value.kind)) {
    return false;
  }

  if (value.kind === "wild") {
    return battle.type === "wild";
  }

  if (battle.type !== "trainer") {
    return false;
  }

  if (
    !isPokemonTrainerBattleId(value.trainerBattleId) ||
    !isNonEmptyString(value.trainerClass)
  ) {
    return false;
  }

  const definition = getPokemonTrainerBattleDefinition(value.trainerBattleId);

  if (value.trainerClass !== definition.trainerClass) {
    return false;
  }

  if (value.kind === "trainer") {
    return definition.category === "standard";
  }

  if (value.kind !== "gym-leader" || definition.category !== "gym-leader") {
    return false;
  }

  const gymLeader = definition.gymLeader;

  return (
    gymLeader !== undefined &&
    value.gymId === gymLeader.gymId &&
    value.badgeId === gymLeader.badgeId &&
    value.leaderPresentationId === gymLeader.leaderPresentationId
  );
}

function isBattleParticipant(value: unknown): value is BattleParticipant {
  if (!isRecord(value)) {
    return false;
  }

  if (!isNonEmptyString(value.id)) {
    return false;
  }

  if (value.type !== "trainer" && value.type !== "wild") {
    return false;
  }

  if (value.side !== "side-a" && value.side !== "side-b") {
    return false;
  }

  const displayName = value.displayName;

  if (
    displayName !== undefined &&
    (!isNonEmptyString(displayName) || displayName !== displayName.trim())
  ) {
    return false;
  }

  if (!Array.isArray(value.pokemon)) {
    return false;
  }

  if (value.pokemon.length === 0) {
    return false;
  }

  if (!value.pokemon.every(isBattlePokemonState)) {
    return false;
  }

  if (!Number.isInteger(value.activePokemonIndex)) {
    return false;
  }

  if (
    (value.activePokemonIndex as number) < 0 ||
    (value.activePokemonIndex as number) >= value.pokemon.length
  ) {
    return false;
  }

  // Wild participant V1 owns exactly one battle Pokémon.

  if (value.type === "wild" && value.pokemon.length !== 1) {
    return false;
  }

  return true;
}

function isBattlePokemonState(value: unknown): value is BattlePokemonState {
  if (!isRecord(value)) {
    return false;
  }

  if (!Number.isInteger(value.currentHp) || (value.currentHp as number) < 0) {
    return false;
  }

  return isBattlePokemonInstance(value.pokemon);
}

function isBattlePokemonInstance(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  if (!isNonEmptyString(value.instanceId)) {
    return false;
  }

  if (!Number.isInteger(value.speciesId) || (value.speciesId as number) <= 0) {
    return false;
  }

  if (!Number.isInteger(value.formId) || (value.formId as number) <= 0) {
    return false;
  }

  if (value.nickname !== undefined && typeof value.nickname !== "string") {
    return false;
  }

  if (!Number.isInteger(value.level) || (value.level as number) <= 0) {
    return false;
  }

  if (!Number.isInteger(value.experience) || (value.experience as number) < 0) {
    return false;
  }

  if (!Number.isInteger(value.currentHp) || (value.currentHp as number) < 0) {
    return false;
  }

  if (!Number.isInteger(value.abilityId) || (value.abilityId as number) <= 0) {
    return false;
  }

  if (!Array.isArray(value.moves)) {
    return false;
  }

  if (value.moves.length > 4) {
    return false;
  }

  return value.moves.every(isBattlePokemonMove);
}

function isBattlePokemonMove(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Number.isInteger(value.moveId) &&
    (value.moveId as number) > 0 &&
    Number.isInteger(value.currentPp) &&
    (value.currentPp as number) >= 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isPokemonBattleCommandInput(
  value: unknown
): value is PokemonBattleCommandInput {
  if (!isRecord(value)) {
    return false;
  }

  if (!isNonEmptyString(value.battleId)) {
    return false;
  }

  return isBattleCommandAction(value.action);
}

function isBattleUseItemTarget(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  switch (value.type) {
    case "trainer-pokemon":
      return isNonEmptyString(value.pokemonInstanceId);

    case "wild-active":
      return true;

    default:
      return false;
  }
}

function isBattleCommandAction(value: unknown): value is BattleCommandAction {
  if (!isRecord(value)) {
    return false;
  }

  switch (value.type) {
    case "use-move":
      return Number.isInteger(value.moveId) && (value.moveId as number) > 0;

    case "switch-pokemon":
      return Number.isInteger(value.pokemonIndex) && (value.pokemonIndex as number) >= 0;

    case "run":
    case "struggle":
      return true;

    case "use-item":
      return isPokemonItemId(value.itemId) && isBattleUseItemTarget(value.target);

    default:
      return false;
  }
}
