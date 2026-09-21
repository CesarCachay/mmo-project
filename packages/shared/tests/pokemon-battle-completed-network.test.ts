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

  it('accepts authoritative Trainer Battle reward details on victory', () => {
    expect(
      isPokemonBattleCompletedPayload({
        battleId: 'battle-completed-test',
        outcome: 'trainer-battle-victory',
        trainerBattleRewards: {
          money: 350,
          items: [{ itemId: 'potion', quantity: 1 }],
        },
      }),
    ).toBe(true);
  });

  it('rejects Trainer Battle rewards on non-victory outcomes', () => {
    expect(
      isPokemonBattleCompletedPayload({
        battleId: 'battle-completed-test',
        outcome: 'wild-defeated',
        trainerBattleRewards: { money: 350, items: [] },
      }),
    ).toBe(false);
  });

  it('rejects malformed Trainer Battle rewards', () => {
    expect(
      isPokemonBattleCompletedPayload({
        battleId: 'battle-completed-test',
        outcome: 'trainer-battle-victory',
        trainerBattleRewards: {
          money: -1,
          items: [{ itemId: 'potion', quantity: 0 }],
        },
      }),
    ).toBe(false);
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
