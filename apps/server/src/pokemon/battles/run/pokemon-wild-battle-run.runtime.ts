import {
  resolveBattleRunAttempt,
  type BattleRunRandomSource,
  type BattleTurnResolutionEntry,
} from '@cesar-mmo/shared';

import type { PokemonBattleSession } from '../pokemon-battle-session.js';

export type PokemonWildBattleRunRuntimeResult =
  | {
      readonly type: 'run-failed';
      readonly stopTurnResolution: false;
    }
  | {
      readonly type: 'run-succeeded';
      readonly stopTurnResolution: true;
      readonly terminalOutcome: 'trainer-escaped';
    };

export interface ResolvePokemonWildBattleRunInput {
  readonly session: PokemonBattleSession;
  readonly entry: BattleTurnResolutionEntry;
  readonly random?: BattleRunRandomSource;
}

export function resolvePokemonWildBattleRun(
  input: ResolvePokemonWildBattleRunInput,
): PokemonWildBattleRunRuntimeResult {
  const { session, entry, random = Math.random } = input;

  const resolution = resolveBattleRunAttempt(session.battle, entry, random);

  if (resolution.type === 'run-failed') {
    return {
      type: 'run-failed',
      stopTurnResolution: false,
    };
  }

  return {
    type: 'run-succeeded',
    stopTurnResolution: true,
    terminalOutcome: 'trainer-escaped',
  };
}
