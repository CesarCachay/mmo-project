import { describe, expect, it, vi } from 'vitest';

import {
  createPokemonInventory,
  createPokemonParty,
  getPokemonInventoryItemQuantity,
} from '@cesar-mmo/shared';

import { PokemonTrainerStateStore } from '../../pokemon-trainer-state.store';
import { PokemonTrainerBattleVictoryService } from '../pokemon-trainer-battle-victory.service';

import type { PokemonTrainerBattleProgressRepository } from '../pokemon-trainer-battle-progress.repository';

const TRAINER_ID = '11111111-1111-4111-8111-111111111111';

describe('PokemonTrainerBattleVictoryService', () => {
  it('uses the persisted reward snapshot and marks the Trainer Battle defeated on first victory', async () => {
    const trainerStateStore = new PokemonTrainerStateStore();
    trainerStateStore.create(
      TRAINER_ID,
      createPokemonParty(),
      createPokemonInventory(),
    );

    const persistedInventory = createPokemonInventory([
      { itemId: 'potion', quantity: 1 },
    ]);
    const recordFirstVictory = vi.fn().mockResolvedValue({
      firstVictory: true,
      money: 3_350,
      inventory: persistedInventory,
      creditedMoney: 350,
    });
    const progressRepository = {
      recordFirstVictory,
      loadDefeatedTrainerBattleIds: vi
        .fn()
        .mockResolvedValue(['student-gary']),
    } as unknown as PokemonTrainerBattleProgressRepository;

    const service = new PokemonTrainerBattleVictoryService(
      progressRepository,
      trainerStateStore,
    );

    const result = await service.recordVictory(TRAINER_ID, 'student-gary');

    expect(result.firstVictory).toBe(true);
    expect(result.rewardItems).toEqual([{ itemId: 'potion', quantity: 1 }]);
    expect(result.rewardMoney).toBe(350);
    expect(result.trainerState.money).toBe(3_350);
    expect(result.trainerState.defeatedTrainerBattleIds).toEqual([
      'student-gary',
    ]);
    expect(
      getPokemonInventoryItemQuantity(result.trainerState.inventory, 'potion'),
    ).toBe(1);

    expect(recordFirstVictory).toHaveBeenCalledWith({
      trainerId: TRAINER_ID,
      trainerBattleId: 'student-gary',
      rewardItems: [{ itemId: 'potion', quantity: 1 }],
      rewardMoney: 350,
    });
  });

  it('reconciles inventory + wallet from persistence when the victory already exists', async () => {
    const trainerStateStore = new PokemonTrainerStateStore();
    trainerStateStore.create(
      TRAINER_ID,
      createPokemonParty(),
      createPokemonInventory(),
      ['student-gary'],
    );

    const progressRepository = {
      recordFirstVictory: vi.fn().mockResolvedValue({
        firstVictory: false,
        money: 3_000,
        inventory: createPokemonInventory([
          { itemId: 'potion', quantity: 2 },
        ]),
        creditedMoney: 0,
      }),
      loadDefeatedTrainerBattleIds: vi
        .fn()
        .mockResolvedValue(['student-gary']),
    } as unknown as PokemonTrainerBattleProgressRepository;

    const service = new PokemonTrainerBattleVictoryService(
      progressRepository,
      trainerStateStore,
    );

    const result = await service.recordVictory(TRAINER_ID, 'student-gary');

    expect(result.firstVictory).toBe(false);
    expect(result.rewardItems).toEqual([]);
    expect(result.rewardMoney).toBe(0);
    expect(result.trainerState.money).toBe(3_000);
    expect(
      getPokemonInventoryItemQuantity(result.trainerState.inventory, 'potion'),
    ).toBe(2);
    expect(result.trainerState.defeatedTrainerBattleIds).toEqual([
      'student-gary',
    ]);
  });

  it('hydrates persisted defeated Trainer Battle ids through the repository', async () => {
    const trainerStateStore = new PokemonTrainerStateStore();
    const loadDefeatedTrainerBattleIds = vi
      .fn()
      .mockResolvedValue(['student-gary', 'student-francisca']);

    const progressRepository = {
      recordFirstVictory: vi.fn(),
      loadDefeatedTrainerBattleIds,
    } as unknown as PokemonTrainerBattleProgressRepository;

    const service = new PokemonTrainerBattleVictoryService(
      progressRepository,
      trainerStateStore,
    );

    await expect(
      service.loadDefeatedTrainerBattleIds(TRAINER_ID),
    ).resolves.toEqual(['student-gary', 'student-francisca']);
  });
});
