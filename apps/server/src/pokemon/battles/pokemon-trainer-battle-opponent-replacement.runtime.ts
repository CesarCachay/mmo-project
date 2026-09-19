import {
  getBattleParticipantById,
  getActiveBattlePokemon,
  replaceFaintedTrainerBattlePokemon,
  resolveTrainerBattleContinuationOutcome,
  type BattlePokemonSwitchedEvent,
} from '@cesar-mmo/shared';

import type { PokemonBattleSession } from './pokemon-battle-session';
import type { PokemonBattleTurnStore } from './pokemon-battle-turn.store';
import { selectTrainerBattleAiReplacementPokemonIndex } from './pokemon-trainer-battle-ai.factory';

export interface ApplyPokemonTrainerBattleOpponentReplacementInput {
  readonly session: PokemonBattleSession;
  readonly localParticipantId: string;
  readonly battleTurnStore: PokemonBattleTurnStore;
}

export interface PokemonTrainerBattleOpponentReplacementResult {
  readonly participantId: string;
  readonly previousActivePokemonIndex: number;
  readonly currentActivePokemonIndex: number;
  readonly previousPokemonInstanceId: string;
  readonly activePokemonInstanceId: string;
  readonly nextTurnNumber: number;
  readonly presentationEvent: BattlePokemonSwitchedEvent;
}

/**
 * Applies the server-authoritative forced replacement for the NPC side of a
 * Trainer Battle.
 *
 * The caller must invoke this only after the current turn has been fully
 * resolved and the opponent's active Pokémon has fainted. The replacement is
 * selected by the Trainer AI profile, applied to the authoritative battle
 * snapshot, and only then is the next turn created.
 */
export function applyPokemonTrainerBattleOpponentReplacement(
  input: ApplyPokemonTrainerBattleOpponentReplacementInput,
): PokemonTrainerBattleOpponentReplacementResult {
  const { session, localParticipantId, battleTurnStore } = input;

  if (session.battle.type !== 'trainer' || !session.trainerBattle) {
    throw new Error(
      `Battle "${session.battle.battleId}" is not a Trainer Battle session`,
    );
  }

  const continuationBefore = resolveTrainerBattleContinuationOutcome(
    session.battle,
    localParticipantId,
  );

  if (continuationBefore.type !== 'opponent-replacement-required') {
    throw new Error(
      `Trainer Battle "${session.battle.battleId}" does not require opponent replacement; continuation is "${continuationBefore.type}"`,
    );
  }

  const opponentParticipant = getBattleParticipantById(
    session.battle,
    session.trainerBattle.opponentParticipantId,
  );

  if (opponentParticipant.type !== 'trainer') {
    throw new Error(
      `Trainer Battle opponent participant "${opponentParticipant.id}" is not a Trainer`,
    );
  }

  const previousActivePokemon = getActiveBattlePokemon(opponentParticipant);

  const replacementPokemonIndex = selectTrainerBattleAiReplacementPokemonIndex(
    session,
    continuationBefore.replacementPokemonIndexes,
  );

  if (!continuationBefore.replacementPokemonIndexes.includes(replacementPokemonIndex)) {
    throw new Error(
      `Trainer Battle AI selected invalid replacement index "${replacementPokemonIndex}" for battle "${session.battle.battleId}"`,
    );
  }

  const replacementResult = replaceFaintedTrainerBattlePokemon(
    opponentParticipant,
    replacementPokemonIndex,
  );

  const continuationAfter = resolveTrainerBattleContinuationOutcome(
    session.battle,
    localParticipantId,
  );

  if (continuationAfter.type !== 'continue') {
    throw new Error(
      `Trainer Battle "${session.battle.battleId}" did not return to continue after opponent replacement; continuation is "${continuationAfter.type}"`,
    );
  }

  const nextTurn = battleTurnStore.advance(session.battle);

  const presentationEvent: BattlePokemonSwitchedEvent = {
    type: 'pokemon-switched',
    participantId: opponentParticipant.id,
    previousActivePokemonIndex:
      replacementResult.previousActivePokemonIndex,
    currentActivePokemonIndex:
      replacementResult.currentActivePokemonIndex,
    previousPokemonInstanceId:
      previousActivePokemon.pokemon.instanceId,
    currentPokemonInstanceId:
      replacementResult.activePokemon.pokemon.instanceId,
  };

  return {
    participantId: opponentParticipant.id,
    previousActivePokemonIndex:
      replacementResult.previousActivePokemonIndex,
    currentActivePokemonIndex:
      replacementResult.currentActivePokemonIndex,
    previousPokemonInstanceId:
      previousActivePokemon.pokemon.instanceId,
    activePokemonInstanceId:
      replacementResult.activePokemon.pokemon.instanceId,
    nextTurnNumber: nextTurn.number,
    presentationEvent,
  };
}
