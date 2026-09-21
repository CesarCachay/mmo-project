import { describe, expect, it } from 'vitest';

import { POKEMON_STARTING_MONEY } from '@cesar-mmo/shared';

import { PokemonTrainerStateStore } from '../../pokemon-trainer-state.store';
import type { PokemonTrainerId } from '../../pokemon-trainer-identity';

const trainerId = '00000000-0000-0000-0000-000000000001' as PokemonTrainerId;

describe('PokemonTrainerStateStore wallet', () => {
  it('hydrates a new runtime state with the starting balance by default', () => {
    const store = new PokemonTrainerStateStore();

    const trainerState = store.create(trainerId);

    expect(trainerState.money).toBe(POKEMON_STARTING_MONEY);
  });

  it('updates the runtime wallet without mutating party or inventory', () => {
    const store = new PokemonTrainerStateStore();
    const initial = store.create(trainerId);

    const updated = store.setMoney(trainerId, 2_450);

    expect(updated.money).toBe(2_450);
    expect(updated.party).toBe(initial.party);
    expect(updated.inventory).toBe(initial.inventory);
  });
});
