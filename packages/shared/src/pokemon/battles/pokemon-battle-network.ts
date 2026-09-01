import type {
  BattleId,
  BattleInstance,
  BattleParticipant,
  BattlePokemonState,
} from "./pokemon-battle.types.js";
import type { BattleCommandAction } from "./pokemon-battle-command.js";

export interface PokemonBattleStartedPayload {
  readonly battle: BattleInstance;
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

  if (!isBattleInstance(value.battle)) {
    return false;
  }

  // A BATTLE_STARTED event must describe an active battle.
  return value.battle.status === "active";
}

function isBattleInstance(value: unknown): value is BattleInstance {
  if (!isRecord(value)) {
    return false;
  }

  if (!isNonEmptyString(value.battleId)) {
    return false;
  }

  if (value.type !== "wild") {
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

  if (trainerParticipants.length !== 1 || wildParticipants.length !== 1) {
    return false;
  }

  const sideA = value.participants.filter((participant) => participant.side === "side-a");

  const sideB = value.participants.filter((participant) => participant.side === "side-b");

  return sideA.length === 1 && sideB.length === 1;
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

function isBattleCommandAction(value: unknown): value is BattleCommandAction {
  if (!isRecord(value)) {
    return false;
  }

  switch (value.type) {
    case "use-move":
      return Number.isInteger(value.moveId) && (value.moveId as number) > 0;

    case "switch-pokemon":
      return Number.isInteger(value.pokemonIndex) && (value.pokemonIndex as number) >= 0;

    default:
      return false;
  }
}
