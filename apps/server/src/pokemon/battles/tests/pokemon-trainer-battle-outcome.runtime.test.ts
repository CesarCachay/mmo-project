import { describe, expect, it, vi } from 'vitest';

import { applyPokemonTrainerBattleOutcome } from '../pokemon-trainer-battle-outcome.runtime';

const battleId = 'trainer-battle-outcome-test';

describe('applyPokemonTrainerBattleOutcome', () => {
  it('completes and cleans up the Battle after defeating the opposing Trainer', () => {
    const complete = vi.fn();
    const remove = vi.fn();

    const result = applyPokemonTrainerBattleOutcome({
      battleId,
      outcome: { type: 'opponent-defeated' },
      battleSessionStore: { complete },
      battleTurnStore: { remove },
    });

    expect(result).toEqual({
      type: 'trainer-battle-victory',
      battleCompleted: true,
    });
    expect(complete).toHaveBeenCalledOnce();
    expect(complete).toHaveBeenCalledWith(battleId);
    expect(remove).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith(battleId);
  });

  it('completes and cleans up the Battle after the player party is defeated', () => {
    const complete = vi.fn();
    const remove = vi.fn();

    const result = applyPokemonTrainerBattleOutcome({
      battleId,
      outcome: { type: 'player-defeated' },
      battleSessionStore: { complete },
      battleTurnStore: { remove },
    });

    expect(result).toEqual({
      type: 'trainer-battle-defeat',
      battleCompleted: true,
    });
    expect(complete).toHaveBeenCalledWith(battleId);
    expect(remove).toHaveBeenCalledWith(battleId);
  });
  it('rejects a non-terminal continuation without releasing the Battle', () => {
    const complete = vi.fn();
    const remove = vi.fn();

    expect(() =>
      applyPokemonTrainerBattleOutcome({
        battleId,
        outcome: { type: 'continue' } as never,
        battleSessionStore: { complete },
        battleTurnStore: { remove },
      }),
    ).toThrow(/unsupported trainer battle terminal outcome/i);

    expect(complete).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

});
