import {
  replaceFaintedTrainerBattlePokemon,
  resolveWildBattleContinuationOutcome,
} from '@cesar-mmo/shared';

import type { BattleParticipant } from '@cesar-mmo/shared';

import type { PokemonBattleSession } from './pokemon-battle-session.js';

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

  // 1. Resolve owner binding.

  const trainerBinding = session.trainerBindings.find(
    (binding) => binding.playerId === playerId,
  );

  if (!trainerBinding) {
    throw new Error(
      `Player "${playerId}" is not bound to battle "${session.battle.battleId}"`,
    );
  }

  // 2. Battle must currently require
  // Trainer replacement.

  const continuationBefore = resolveWildBattleContinuationOutcome(
    session.battle,
  );

  if (continuationBefore.type !== 'trainer-replacement-required') {
    throw new Error(
      `Battle "${session.battle.battleId}" does not require Trainer replacement`,
    );
  }

  // 3. Requested index must be one of
  // the server-computed candidates.

  if (
    !continuationBefore.replacementPokemonIndexes.includes(
      replacementPokemonIndex,
    )
  ) {
    throw new Error(
      `Replacement Pokémon index "${replacementPokemonIndex}" is not available for battle "${session.battle.battleId}"`,
    );
  }

  // 4. Resolve authoritative Trainer
  // participant through server binding.

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

  // 6. Replacement must return Battle
  // to normal continuation.

  const continuationAfter = resolveWildBattleContinuationOutcome(
    session.battle,
  );

  if (continuationAfter.type !== 'continue') {
    throw new Error(
      `Battle "${session.battle.battleId}" did not return to continue after Trainer replacement`,
    );
  }

  // 7. Turn N was already resolved and
  // retained while waiting for replacement.
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
