import { getPokemonMove } from "../pokemon-move.registry.js";

import type { PokemonInstanceMove, PokemonMove } from "../pokemon.types.js";

import { getActiveBattlePokemon } from "./pokemon-battle-participant.js";

import { isBattleActive } from "./pokemon-battle-lifecycle.js";

import type { BattleTurnResolutionEntry } from "./pokemon-battle-turn-order.js";

import type {
  BattleId,
  BattleInstance,
  BattleParticipantId,
  BattlePokemonState,
} from "./pokemon-battle.types.js";

export interface BattleMoveExecutionContext {
  readonly battleId: BattleId;
  readonly actorParticipantId: BattleParticipantId;
  readonly targetParticipantId: BattleParticipantId;
  readonly actorPokemon: BattlePokemonState;
  readonly targetPokemon: BattlePokemonState;
  readonly selectedMove: PokemonInstanceMove;
  readonly move: PokemonMove;
}

export function createBattleMoveExecutionContext(
  battle: BattleInstance,
  entry: BattleTurnResolutionEntry
): BattleMoveExecutionContext {
  //
  // 1. Battle must still be active.
  //

  if (!isBattleActive(battle)) {
    throw new Error(
      `Cannot create move execution context for battle "${battle.battleId}" with status "${battle.status}"`
    );
  }

  //
  // 2. Command must belong to this Battle.
  //

  if (entry.command.battleId !== battle.battleId) {
    throw new Error(
      `Battle command "${entry.command.battleId}" does not belong to battle "${battle.battleId}"`
    );
  }

  //
  // 3. Resolve actor.
  //

  const actorParticipant = battle.participants.find(
    (participant) => participant.id === entry.command.participantId
  );

  if (!actorParticipant) {
    throw new Error(
      `Battle participant "${entry.command.participantId}" not found in battle "${battle.battleId}"`
    );
  }

  const actorPokemon = getActiveBattlePokemon(actorParticipant);

  //
  // 4. Current command domain only supports
  // use-move.
  //

  if (entry.command.action.type !== "use-move") {
    throw new Error(
      `Unsupported battle command action while creating move execution context`
    );
  }

  const moveId = entry.command.action.moveId;

  //
  // 5. Revalidate the runtime Pokémon move.
  //
  // Do not blindly trust a previously accepted command:
  // runtime Battle state may eventually change between
  // command submission and execution.
  //

  const selectedMove = actorPokemon.pokemon.moves.find(
    (candidate) => candidate.moveId === moveId
  );

  if (!selectedMove) {
    throw new Error(
      `Pokémon "${actorPokemon.pokemon.instanceId}" does not know move "${moveId}"`
    );
  }

  if (selectedMove.currentPp <= 0) {
    throw new Error(`Move "${moveId}" has no PP remaining at execution time`);
  }

  //
  // 6. Resolve static Move definition.
  //

  const move = getPokemonMove(moveId);

  if (!move) {
    throw new Error(
      `Pokémon move "${moveId}" not found while creating battle move execution context`
    );
  }

  //
  // 7. Resolve target.
  //
  // Current Battle foundation is strictly
  // 1v1 Wild Battle.
  //

  const targetParticipants = battle.participants.filter(
    (participant) => participant.side !== actorParticipant.side
  );

  if (targetParticipants.length !== 1) {
    throw new Error(
      `Battle "${battle.battleId}" must have exactly one opposing participant for move execution`
    );
  }

  const targetParticipant = targetParticipants[0];

  if (!targetParticipant) {
    throw new Error(`Target participant not found in battle "${battle.battleId}"`);
  }

  const targetPokemon = getActiveBattlePokemon(targetParticipant);

  return {
    battleId: battle.battleId,
    actorParticipantId: actorParticipant.id,
    targetParticipantId: targetParticipant.id,
    actorPokemon,
    targetPokemon,
    selectedMove,
    move,
  };
}
