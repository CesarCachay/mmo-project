import type {
  BattleId,
  PokemonBattleCompletedOutcome,
  TrainerBattleContinuationOutcome,
} from '@cesar-mmo/shared';

export interface PokemonTrainerBattleCompletionStore {
  complete(battleId: BattleId): unknown;
}

export interface PokemonTrainerBattleTurnCleanupStore {
  remove(battleId: BattleId): unknown;
}

export type TrainerBattleTerminalContinuationOutcome = Extract<
  TrainerBattleContinuationOutcome,
  { readonly type: 'player-defeated' | 'opponent-defeated' }
>;

export type PokemonTrainerBattleOutcomeRuntimeResult =
  | {
      readonly type: 'trainer-battle-victory';
      readonly battleCompleted: true;
    }
  | {
      readonly type: 'trainer-battle-defeat';
      readonly battleCompleted: true;
    };

export interface ApplyPokemonTrainerBattleOutcomeInput {
  readonly battleId: BattleId;
  readonly outcome: TrainerBattleTerminalContinuationOutcome;
  readonly battleSessionStore: PokemonTrainerBattleCompletionStore;
  readonly battleTurnStore: PokemonTrainerBattleTurnCleanupStore;
}

export function applyPokemonTrainerBattleOutcome(
  input: ApplyPokemonTrainerBattleOutcomeInput,
): PokemonTrainerBattleOutcomeRuntimeResult {
  const { battleId, outcome, battleSessionStore, battleTurnStore } = input;

  let type: Extract<
    PokemonBattleCompletedOutcome,
    'trainer-battle-victory' | 'trainer-battle-defeat'
  >;

  switch (outcome.type) {
    case 'opponent-defeated':
      type = 'trainer-battle-victory';
      break;

    case 'player-defeated':
      type = 'trainer-battle-defeat';
      break;

    default: {
      const exhaustive: never = outcome;
      throw new Error(
        `Unsupported Trainer Battle terminal outcome "${String(exhaustive)}"`,
      );
    }
  }

  battleSessionStore.complete(battleId);
  battleTurnStore.remove(battleId);

  return {
    type,
    battleCompleted: true,
  };
}
