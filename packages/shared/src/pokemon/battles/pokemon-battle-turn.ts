import type {
  BattleId,
  BattleInstance,
  BattleParticipantId,
} from "./pokemon-battle.types.js";

import type { BattleCommand } from "./pokemon-battle-command.js";

import { isBattleActive } from "./pokemon-battle-lifecycle.js";

export type BattleTurnNumber = number;

export interface BattleTurn {
  readonly battleId: BattleId;
  readonly number: BattleTurnNumber;
  readonly commands: readonly BattleCommand[];
}

export function createBattleTurn(
  battle: BattleInstance,
  turnNumber: BattleTurnNumber
): BattleTurn {
  if (!isBattleActive(battle)) {
    throw new Error(
      `Cannot create turn for battle "${battle.battleId}" with status "${battle.status}"`
    );
  }

  if (!Number.isInteger(turnNumber) || turnNumber <= 0) {
    throw new Error(`Invalid battle turn number "${turnNumber}"`);
  }

  return {
    battleId: battle.battleId,
    number: turnNumber,
    commands: [],
  };
}

export function addBattleTurnCommand(
  battle: BattleInstance,
  turn: BattleTurn,
  command: BattleCommand
): BattleTurn {
  if (!isBattleActive(battle)) {
    throw new Error(
      `Cannot add command to turn ${turn.number} because battle "${battle.battleId}" is not active`
    );
  }

  if (turn.battleId !== battle.battleId) {
    throw new Error(`Turn ${turn.number} does not belong to battle "${battle.battleId}"`);
  }

  if (command.battleId !== battle.battleId) {
    throw new Error(
      `Command battle "${command.battleId}" does not match battle "${battle.battleId}"`
    );
  }

  const participant = battle.participants.find(
    (candidate) => candidate.id === command.participantId
  );

  if (!participant) {
    throw new Error(
      `Battle participant "${command.participantId}" not found in battle "${battle.battleId}"`
    );
  }

  if (hasBattleTurnCommand(turn, command.participantId)) {
    throw new Error(
      `Participant "${command.participantId}" already submitted a command for turn ${turn.number}`
    );
  }

  return {
    ...turn,
    commands: [...turn.commands, command],
  };
}

export function hasBattleTurnCommand(
  turn: BattleTurn,
  participantId: BattleParticipantId
): boolean {
  return turn.commands.some((command) => command.participantId === participantId);
}

export function isBattleTurnReady(battle: BattleInstance, turn: BattleTurn): boolean {
  if (turn.battleId !== battle.battleId) {
    throw new Error(`Turn ${turn.number} does not belong to battle "${battle.battleId}"`);
  }

  return battle.participants.every((participant) =>
    hasBattleTurnCommand(turn, participant.id)
  );
}

export function createNextBattleTurn(
  battle: BattleInstance,
  currentTurn: BattleTurn
): BattleTurn {
  if (currentTurn.battleId !== battle.battleId) {
    throw new Error(
      `Battle turn "${currentTurn.battleId}" does not belong to battle "${battle.battleId}"`
    );
  }

  if (!isBattleTurnReady(battle, currentTurn)) {
    throw new Error(
      `Cannot advance battle "${battle.battleId}" from incomplete turn "${currentTurn.number}"`
    );
  }

  return createBattleTurn(battle, currentTurn.number + 1);
}
