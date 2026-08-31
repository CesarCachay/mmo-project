import type {
  BattleId,
  BattleInstance,
  BattleParticipantId,
} from "./pokemon-battle.types.js";

import { getActiveBattlePokemon } from "./pokemon-battle-participant.js";

import { isBattleActive } from "./pokemon-battle-lifecycle.js";

export interface BattleUseMoveAction {
  readonly type: "use-move";
  readonly moveId: number;
}

export type BattleCommandAction = BattleUseMoveAction;

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

  switch (input.action.type) {
    case "use-move": {
      assertValidUseMoveAction(battle, participant.id, input.action);

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
