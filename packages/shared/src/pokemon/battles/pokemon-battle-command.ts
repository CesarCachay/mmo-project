import type {
  BattleId,
  BattleInstance,
  BattleParticipantId,
} from "./pokemon-battle.types.js";

import { getActiveBattlePokemon } from "./pokemon-battle-participant.js";

import { isBattleActive } from "./pokemon-battle-lifecycle.js";

import type { PokemonItemId } from "../inventory/pokemon-inventory.js";
import { isPokemonItemId } from "../inventory/pokemon-inventory.js";

import { getPokemonItem } from "../items/pokemon-item.registry.js";
import { assertPokemonBattleCommandActionAllowed } from "./pokemon-battle-rules.js";

export interface BattleUseMoveAction {
  readonly type: "use-move";
  readonly moveId: number;
}
export interface BattleSwitchPokemonAction {
  readonly type: "switch-pokemon";
  readonly pokemonIndex: number;
}
export interface BattleRunAction {
  readonly type: "run";
}

/**
 * Internal Battle fallback used by server-controlled opponents when every
 * regular move is out of PP. The public network command validator does not
 * accept this action from clients.
 *
 * V1 intentionally models Struggle without recoil; recoil can be added when
 * self-damage / simultaneous faint rules are introduced.
 */
export interface BattleStruggleAction {
  readonly type: "struggle";
}

export const POKEMON_STRUGGLE_MOVE_ID = 165;
export type BattleUseItemTarget =
  | {
      readonly type: "trainer-pokemon";
      readonly pokemonInstanceId: string;
    }
  | {
      readonly type: "wild-active";
    };

export interface BattleUseItemAction {
  readonly type: "use-item";
  readonly itemId: PokemonItemId;
  readonly target: BattleUseItemTarget;
}

export type BattleCommandAction =
  | BattleUseMoveAction
  | BattleSwitchPokemonAction
  | BattleRunAction
  | BattleUseItemAction
  | BattleStruggleAction;

export interface BattleCommand {
  readonly battleId: BattleId;
  readonly participantId: BattleParticipantId;
  readonly action: BattleCommandAction;
}

export interface CreateBattleCommandInput {
  readonly participantId: BattleParticipantId;
  readonly action: BattleCommandAction;
}

export function createBattleCommand(
  battle: BattleInstance,
  input: CreateBattleCommandInput
): BattleCommand {
  if (!isBattleActive(battle)) {
    throw new Error(
      `Cannot create command for battle "${battle.battleId}" with status "${battle.status}"`
    );
  }

  const participant = battle.participants.find(
    (candidate) => candidate.id === input.participantId
  );

  if (!participant) {
    throw new Error(
      `Battle participant "${input.participantId}" not found in battle "${battle.battleId}"`
    );
  }

  /*
   * Battle-type rules are enforced in the shared domain so every caller
   * (network runtime, AI/runtime helpers and future clients) observes the
   * same Wild-vs-Trainer semantics.
   */
  assertPokemonBattleCommandActionAllowed(battle, input.action);

  switch (input.action.type) {
    case "use-move": {
      assertValidUseMoveAction(battle, participant.id, input.action);
      break;
    }
    case "switch-pokemon": {
      assertValidSwitchPokemonAction(battle, input.action);
      break;
    }
    case "run": {
      assertValidRunAction(battle, participant.id);
      break;
    }
    case "use-item": {
      assertValidUseItemAction(battle, participant.id, input.action);
      break;
    }
    case "struggle": {
      assertValidStruggleAction(battle, participant.id);
      break;
    }
  }

  return {
    battleId: battle.battleId,
    participantId: participant.id,
    action: {
      ...input.action,
    },
  };
}

function assertValidUseMoveAction(
  battle: BattleInstance,
  participantId: BattleParticipantId,
  action: BattleUseMoveAction
): void {
  if (!Number.isInteger(action.moveId) || action.moveId <= 0) {
    throw new Error(`Invalid moveId "${action.moveId}" for battle "${battle.battleId}"`);
  }

  const participant = battle.participants.find(
    (candidate) => candidate.id === participantId
  );

  if (!participant) {
    throw new Error(
      `Battle participant "${participantId}" not found in battle "${battle.battleId}"`
    );
  }

  const activePokemon = getActiveBattlePokemon(participant);

  const move = activePokemon.pokemon.moves.find(
    (candidate) => candidate.moveId === action.moveId
  );

  if (!move) {
    throw new Error(
      `Pokémon "${activePokemon.pokemon.instanceId}" does not know move "${action.moveId}"`
    );
  }

  if (move.currentPp <= 0) {
    throw new Error(`Move "${action.moveId}" has no PP remaining`);
  }
}

function assertValidSwitchPokemonAction(
  battle: BattleInstance,
  action: BattleSwitchPokemonAction
): void {
  if (!Number.isInteger(action.pokemonIndex) || action.pokemonIndex < 0) {
    throw new Error(
      `Invalid Pokémon index "${action.pokemonIndex}" for battle "${battle.battleId}"`
    );
  }
}

function assertValidRunAction(
  battle: BattleInstance,
  participantId: BattleParticipantId
): void {
  const participant = battle.participants.find(
    (candidate) => candidate.id === participantId
  );

  if (!participant) {
    throw new Error(
      `Battle participant "${participantId}" not found in battle "${battle.battleId}"`
    );
  }

  if (participant.type !== "trainer") {
    throw new Error(
      `Battle participant "${participantId}" cannot run because it is not a Trainer`
    );
  }
}

function assertValidUseItemAction(
  battle: BattleInstance,
  participantId: BattleParticipantId,
  action: BattleUseItemAction
): void {
  const participant = battle.participants.find(
    (candidate) => candidate.id === participantId
  );

  if (!participant) {
    throw new Error(
      `Battle participant "${participantId}" not found in battle "${battle.battleId}"`
    );
  }

  if (participant.type !== "trainer") {
    throw new Error(`Battle participant "${participantId}" cannot use Trainer items`);
  }

  if (!isPokemonItemId(action.itemId)) {
    throw new Error(
      `Invalid Pokémon item "${action.itemId}" for battle "${battle.battleId}"`
    );
  }

  if (!action.target || typeof action.target !== "object") {
    throw new Error(`Invalid item target for battle "${battle.battleId}"`);
  }

  switch (action.target.type) {
    case "trainer-pokemon": {
      if (
        typeof action.target.pokemonInstanceId !== "string" ||
        action.target.pokemonInstanceId.trim().length === 0
      ) {
        throw new Error(
          `Invalid Trainer Pokémon item target for battle "${battle.battleId}"`
        );
      }

      break;
    }

    case "wild-active": {
      break;
    }

    default: {
      throw new Error(`Invalid item target for battle "${battle.battleId}"`);
    }
  }

  const item = getPokemonItem(action.itemId);

  if (!item.battleUsable) {
    throw new Error(`Pokémon item "${action.itemId}" cannot be used in battle`);
  }

  if (item.battleTarget !== action.target.type) {
    throw new Error(
      `Pokémon item "${action.itemId}" cannot target "${action.target.type}"`
    );
  }
}


function assertValidStruggleAction(
  battle: BattleInstance,
  participantId: BattleParticipantId
): void {
  const participant = battle.participants.find(
    (candidate) => candidate.id === participantId
  );

  if (!participant) {
    throw new Error(
      `Battle participant "${participantId}" not found in battle "${battle.battleId}"`
    );
  }

  const activePokemon = getActiveBattlePokemon(participant);

  if (activePokemon.pokemon.moves.some((move) => move.currentPp > 0)) {
    throw new Error(
      `Pokémon "${activePokemon.pokemon.instanceId}" cannot use Struggle while a regular move still has PP`
    );
  }
}
