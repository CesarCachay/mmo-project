import { describe, expect, it } from 'vitest';

import {
  POKEMON_STARTER_REWARD_ITEMS,
  getDialogue,
  isPokemonStarterSelectedPayload,
} from '../src/index.js';

describe('starter reward contract', () => {
  it('awards five Poké Balls', () => {
    expect(POKEMON_STARTER_REWARD_ITEMS).toEqual([
      { itemId: 'poke-ball', quantity: 5 },
    ]);
  });

  it('validates the starter selected acknowledgement payload', () => {
    expect(
      isPokemonStarterSelectedPayload({
        starterId: 'SQUIRTLE',
        rewardItems: [{ itemId: 'poke-ball', quantity: 5 }],
      }),
    ).toBe(true);

    expect(
      isPokemonStarterSelectedPayload({
        starterId: 'SQUIRTLE',
        rewardItems: [{ itemId: 'poke-ball', quantity: 0 }],
      }),
    ).toBe(false);
  });

  it('provides a different Professor Oak/Juan dialogue after starter selection', () => {
    const before = getDialogue('professor-oak-greet');
    const after = getDialogue('professor-oak-after-starter');

    expect(before).toBeDefined();
    expect(after).toBeDefined();
    expect(after?.lines).not.toEqual(before?.lines);
    expect(after?.lines.join(' ')).toContain('5 Poké Balls');
  });
});
