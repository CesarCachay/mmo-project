import type {
  BattleId,
  WildBattleContinuationOutcome,
} from '@cesar-mmo/shared';

export interface PokemonBattleCompletionStore {
  complete(battleId: BattleId): unknown;
}

export interface PokemonBattleTurnCleanupStore {
  remove(battleId: BattleId): unknown;
}

export type PokemonWildBattleOutcomeRuntimeResult =
  | {
      readonly type: 'continue';
      readonly battleCompleted: false;
    }
  | {
      readonly type: 'trainer-replacement-required';
      readonly battleCompleted: false;
      readonly replacementPokemonIndexes: readonly number[];
    }
  | {
      readonly type: 'trainer-defeated';
      readonly battleCompleted: true;
    }
  | {
      readonly type: 'wild-defeated';
      readonly battleCompleted: true;
    };

export interface ApplyPokemonWildBattleOutcomeInput {
  readonly battleId: BattleId;
  readonly outcome: WildBattleContinuationOutcome;
  readonly battleSessionStore: PokemonBattleCompletionStore;
  readonly battleTurnStore: PokemonBattleTurnCleanupStore;
}

export interface ApplyPokemonWildBattleEscapeOutcomeInput {
  readonly battleId: BattleId;
  readonly battleSessionStore: PokemonBattleCompletionStore;
  readonly battleTurnStore: PokemonBattleTurnCleanupStore;
}

export interface PokemonWildBattleEscapeOutcomeRuntimeResult {
  readonly type: 'trainer-escaped';
  readonly battleCompleted: true;
}

export function applyPokemonWildBattleOutcome(
  input: ApplyPokemonWildBattleOutcomeInput,
): PokemonWildBattleOutcomeRuntimeResult {
  const { battleId, outcome, battleSessionStore, battleTurnStore } = input;

  switch (outcome.type) {
    case 'continue': {
      return {
        type: 'continue',
        battleCompleted: false,
      };
    }

    case 'trainer-replacement-required': {
      return {
        type: 'trainer-replacement-required',
        battleCompleted: false,
        replacementPokemonIndexes: outcome.replacementPokemonIndexes,
      };
    }

    case 'trainer-defeated': {
      battleSessionStore.complete(battleId);
      battleTurnStore.remove(battleId);

      return {
        type: 'trainer-defeated',
        battleCompleted: true,
      };
    }

    case 'wild-defeated': {
      battleSessionStore.complete(battleId);
      battleTurnStore.remove(battleId);

      return {
        type: 'wild-defeated',
        battleCompleted: true,
      };
    }
  }
}

export function applyPokemonWildBattleEscapeOutcome(
  input: ApplyPokemonWildBattleEscapeOutcomeInput,
): PokemonWildBattleEscapeOutcomeRuntimeResult {
  const { battleId, battleSessionStore, battleTurnStore } = input;

  battleSessionStore.complete(battleId);
  battleTurnStore.remove(battleId);

  return {
    type: 'trainer-escaped',
    battleCompleted: true,
  };
}

export interface ApplyPokemonWildBattleCaptureOutcomeInput {
  readonly battleId: BattleId;
  readonly battleSessionStore: PokemonBattleCompletionStore;
  readonly battleTurnStore: PokemonBattleTurnCleanupStore;
}

export function applyPokemonWildBattleCaptureOutcome(
  input: ApplyPokemonWildBattleCaptureOutcomeInput,
) {
  const { battleId, battleSessionStore, battleTurnStore } = input;

  battleSessionStore.complete(battleId);
  battleTurnStore.remove(battleId);

  return {
    type: 'wild-captured' as const,
    battleCompleted: true as const,
  };
}
