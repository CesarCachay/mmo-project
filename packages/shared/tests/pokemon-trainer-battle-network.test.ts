import { describe, expect, it } from 'vitest';

import { isPokemonTrainerBattleStartInput } from '../src/pokemon/trainers/pokemon-trainer-battle-network.js';

describe('isPokemonTrainerBattleStartInput', () => {
  it('accepts a valid Trainer NPC id', () => {
    expect(
      isPokemonTrainerBattleStartInput({
        npcId: 'studentGary',
      }),
    ).toBe(true);
  });

  it('rejects an empty or malformed Trainer NPC id', () => {
    expect(isPokemonTrainerBattleStartInput({ npcId: '' })).toBe(false);
    expect(isPokemonTrainerBattleStartInput({ npcId: '   ' })).toBe(false);
    expect(isPokemonTrainerBattleStartInput({ npcId: 123 })).toBe(false);
    expect(isPokemonTrainerBattleStartInput(null)).toBe(false);
  });
});
