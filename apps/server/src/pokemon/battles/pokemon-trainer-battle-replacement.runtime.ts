import {
  replaceFaintedTrainerBattlePokemon,
  resolveTrainerBattleContinuationOutcome,
  resolveWildBattleContinuationOutcome,
} from '@cesar-mmo/shared';

import type { BattleParticipant } from '@cesar-mmo/shared';

import {
  markPokemonBattleParticipation,
  type PokemonBattleSession,
} from './pokemon-battle-session.js';

import type { PokemonBattleTurnStore } from './pokemon-battle-turn.store.js';

export interface ApplyPokemonTrainerBattleReplacementInput {
  readonly session: PokemonBattleSession;
  readonly playerId: string;
  readonly replacementPokemonIndex: number;
  readonly battleTurnStore: PokemonBattleTurnStore;
}

export interface PokemonTrainerBattleReplacementRuntimeResult {
  readonly battleId: string;
  readonly participantId: string;
  readonly previousActivePokemonIndex: number;
  readonly currentActivePokemonIndex: number;
  readonly activePokemonInstanceId: string;
  readonly nextTurnNumber: number;
}

export function applyPokemonTrainerBattleReplacement(
  input: ApplyPokemonTrainerBattleReplacementInput,
): PokemonTrainerBattleReplacementRuntimeResult {
  const { session, playerId, replacementPokemonIndex, battleTurnStore } = input;

  // 1. Resolve the authoritative local Trainer binding.
  const trainerBinding = session.trainerBindings.find(
    (binding) => binding.playerId === playerId,
  );

  if (!trainerBinding) {
    throw new Error(
      `Player "${playerId}" is not bound to battle "${session.battle.battleId}"`,
    );
  }

  // 2. Resolve replacement candidates from the correct battle domain.
  const continuationBefore =
    session.battle.type === 'trainer'
      ? resolveTrainerBattleContinuationOutcome(
          session.battle,
          trainerBinding.participantId,
        )
      : resolveWildBattleContinuationOutcome(session.battle);

  const replacementPokemonIndexes =
    session.battle.type === 'trainer'
      ? continuationBefore.type === 'player-replacement-required'
        ? continuationBefore.replacementPokemonIndexes
        : null
      : continuationBefore.type === 'trainer-replacement-required'
        ? continuationBefore.replacementPokemonIndexes
        : null;

  if (!replacementPokemonIndexes) {
    throw new Error(
      `Battle "${session.battle.battleId}" does not require local Trainer replacement`,
    );
  }

  // 3. Requested index must be one of the server-computed candidates.
  if (!replacementPokemonIndexes.includes(replacementPokemonIndex)) {
    throw new Error(
      `Replacement Pokémon index "${replacementPokemonIndex}" is not available for battle "${session.battle.battleId}"`,
    );
  }

  // 4. Resolve the authoritative local Trainer participant through the server binding.
  const trainerParticipant = session.battle.participants.find(
    (participant) => participant.id === trainerBinding.participantId,
  );

  if (!trainerParticipant) {
    throw new Error(
      `Trainer participant "${trainerBinding.participantId}" not found in battle "${session.battle.battleId}"`,
    );
  }

  assertTrainerParticipant(trainerParticipant);

  // 5. Domain mutation.
  const replacementResult = replaceFaintedTrainerBattlePokemon(
    trainerParticipant,
    replacementPokemonIndex,
  );

  markPokemonBattleParticipation(
    session,
    trainerParticipant.id,
    replacementResult.activePokemon.pokemon.instanceId,
  );

  // 6. A local forced replacement must restore normal continuation.
  const continuationAfter =
    session.battle.type === 'trainer'
      ? resolveTrainerBattleContinuationOutcome(
          session.battle,
          trainerBinding.participantId,
        )
      : resolveWildBattleContinuationOutcome(session.battle);

  if (continuationAfter.type !== 'continue') {
    throw new Error(
      `Battle "${session.battle.battleId}" did not return to continue after local Trainer replacement; continuation is "${continuationAfter.type}"`,
    );
  }

  // 7. Turn N was already fully resolved and retained while waiting for replacement.
  const nextTurn = battleTurnStore.advance(session.battle);

  return {
    battleId: session.battle.battleId,
    participantId: trainerParticipant.id,
    previousActivePokemonIndex: replacementResult.previousActivePokemonIndex,
    currentActivePokemonIndex: replacementResult.currentActivePokemonIndex,
    activePokemonInstanceId: replacementResult.activePokemon.pokemon.instanceId,
    nextTurnNumber: nextTurn.number,
  };
}

function assertTrainerParticipant(participant: BattleParticipant): void {
  if (participant.type !== 'trainer') {
    throw new Error(`Battle participant "${participant.id}" is not a Trainer`);
  }
}
