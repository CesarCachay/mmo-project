import { describe, expect, it, vi } from 'vitest';

import {
  createPokemonInventory,
  getPokemonInventoryItemQuantity,
  POKEMON_STARTER_REWARD_ITEMS,
} from '@cesar-mmo/shared';

import { PokemonTrainerStateStore } from '../pokemon-trainer-state.store';
import { PokemonTrainerService } from '../pokemon-trainer.service';
import type { PokemonStarterSelectionRepository } from '../pokemon-starter-selection.repository';
import type { PokemonPartyRepository } from '../pokemon-party.repository';
import type { PokemonInventoryRepository } from '../inventory/pokemon-inventory.repository';
import type { PokemonTrainerId } from '../pokemon-trainer-identity';

const TRAINER_ID = '11111111-1111-4111-8111-111111111111' as PokemonTrainerId;

describe('PokemonTrainerService starter selection', () => {
  it('persists the starter and awards exactly five Poké Balls before updating RAM', async () => {
    const stateStore = new PokemonTrainerStateStore();
    stateStore.create(TRAINER_ID);
    stateStore.unlockStarterSelection(TRAINER_ID);

    const persistSelection = vi.fn(async () => ({
      inventory: createPokemonInventory([
        { itemId: 'poke-ball', quantity: 5 },
      ]),
    }));

    const service = new PokemonTrainerService(
      stateStore,
      {} as PokemonPartyRepository,
      {} as PokemonInventoryRepository,
      { persistSelection } as unknown as PokemonStarterSelectionRepository,
    );

    const result = await service.chooseStarter(TRAINER_ID, 'BULBASAUR');

    expect(persistSelection).toHaveBeenCalledTimes(1);
    expect(persistSelection).toHaveBeenCalledWith(
      expect.objectContaining({
        trainerId: TRAINER_ID,
        rewardItems: POKEMON_STARTER_REWARD_ITEMS,
      }),
    );
    expect(result.trainerState.party.pokemon).toHaveLength(1);
    expect(result.trainerState.party.pokemon[0]?.speciesId).toBe(1);
    expect(
      getPokemonInventoryItemQuantity(result.trainerState.inventory, 'poke-ball'),
    ).toBe(5);
    expect(result.rewardItems).toEqual(POKEMON_STARTER_REWARD_ITEMS);
    expect(stateStore.isStarterSelectionUnlocked(TRAINER_ID)).toBe(false);
  });

  it('re-unlocks starter selection when persistence fails', async () => {
    const stateStore = new PokemonTrainerStateStore();
    stateStore.create(TRAINER_ID);
    stateStore.unlockStarterSelection(TRAINER_ID);

    const service = new PokemonTrainerService(
      stateStore,
      {} as PokemonPartyRepository,
      {} as PokemonInventoryRepository,
      {
        persistSelection: vi.fn(async () => {
          throw new Error('database unavailable');
        }),
      } as unknown as PokemonStarterSelectionRepository,
    );

    await expect(service.chooseStarter(TRAINER_ID, 'CHARMANDER')).rejects.toThrow(
      'database unavailable',
    );

    expect(stateStore.isStarterSelectionUnlocked(TRAINER_ID)).toBe(true);
    expect(stateStore.get(TRAINER_ID)?.party.pokemon).toHaveLength(0);
  });
});
