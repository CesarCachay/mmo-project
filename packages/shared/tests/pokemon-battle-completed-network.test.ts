import { describe, expect, it } from 'vitest';

import { isPokemonBattleCompletedPayload } from '../src/pokemon/pokemon-network.js';

describe('isPokemonBattleCompletedPayload', () => {
  it.each([
    'trainer-defeated',
    'wild-defeated',
    'trainer-escaped',
    'wild-captured',
    'trainer-battle-victory',
    'trainer-battle-defeat',
  ] as const)('accepts outcome %s', (outcome) => {
    expect(
      isPokemonBattleCompletedPayload({
        battleId: 'battle-completed-test',
        outcome,
      }),
    ).toBe(true);
  });

  it('rejects an unknown completion outcome', () => {
    expect(
      isPokemonBattleCompletedPayload({
        battleId: 'battle-completed-test',
        outcome: 'trainer-won-somehow',
      }),
    ).toBe(false);
  });
});
