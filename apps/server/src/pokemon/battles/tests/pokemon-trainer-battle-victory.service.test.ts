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
  it('grants the configured reward and marks the Trainer Battle defeated on first victory', async () => {
    const trainerStateStore = new PokemonTrainerStateStore();
    trainerStateStore.create(
      TRAINER_ID,
      createPokemonParty(),
      createPokemonInventory(),
    );

    const recordFirstVictory = vi.fn().mockResolvedValue(true);
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
    expect(result.trainerState.defeatedTrainerBattleIds).toEqual([
      'student-gary',
    ]);
    expect(
      getPokemonInventoryItemQuantity(result.trainerState.inventory, 'potion'),
    ).toBe(1);

    expect(recordFirstVictory).toHaveBeenCalledWith(
      expect.objectContaining({
        trainerId: TRAINER_ID,
        trainerBattleId: 'student-gary',
        inventory: expect.objectContaining({
          items: [{ itemId: 'potion', quantity: 1 }],
        }),
      }),
    );
  });

  it('does not duplicate one-time rewards when the victory already exists', async () => {
    const trainerStateStore = new PokemonTrainerStateStore();
    trainerStateStore.create(
      TRAINER_ID,
      createPokemonParty(),
      createPokemonInventory([{ itemId: 'potion', quantity: 1 }]),
      ['student-gary'],
    );

    const progressRepository = {
      recordFirstVictory: vi.fn().mockResolvedValue(false),
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
    expect(
      getPokemonInventoryItemQuantity(result.trainerState.inventory, 'potion'),
    ).toBe(1);
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
