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
      earnedGymBadgeIds: [],
    });
    const progressRepository = {
      recordFirstVictory,
      loadDefeatedTrainerBattleIds: vi
        .fn()
        .mockResolvedValue(['student-gary']),
      loadEarnedGymBadgeIds: vi.fn().mockResolvedValue([]),
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
        earnedGymBadgeIds: [],
      }),
      loadDefeatedTrainerBattleIds: vi
        .fn()
        .mockResolvedValue(['student-gary']),
      loadEarnedGymBadgeIds: vi.fn().mockResolvedValue([]),
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
      loadEarnedGymBadgeIds: vi.fn().mockResolvedValue([]),
    } as unknown as PokemonTrainerBattleProgressRepository;

    const service = new PokemonTrainerBattleVictoryService(
      progressRepository,
      trainerStateStore,
    );

    await expect(
      service.loadDefeatedTrainerBattleIds(TRAINER_ID),
    ).resolves.toEqual(['student-gary', 'student-francisca']);
  });

  it('awards and adopts the Boulder Badge on Brock first victory', async () => {
    const trainerStateStore = new PokemonTrainerStateStore();
    trainerStateStore.create(
      TRAINER_ID,
      createPokemonParty(),
      createPokemonInventory(),
    );

    const recordFirstVictory = vi.fn().mockResolvedValue({
      firstVictory: true,
      money: 4_800,
      inventory: createPokemonInventory([
        { itemId: 'super-potion', quantity: 2 },
      ]),
      creditedMoney: 1_800,
      earnedGymBadgeIds: ['boulder-badge'],
      awardedGymBadgeId: 'boulder-badge',
    });

    const progressRepository = {
      recordFirstVictory,
      loadDefeatedTrainerBattleIds: vi
        .fn()
        .mockResolvedValue(['gym-leader-brock']),
      loadEarnedGymBadgeIds: vi.fn().mockResolvedValue(['boulder-badge']),
    } as unknown as PokemonTrainerBattleProgressRepository;

    const service = new PokemonTrainerBattleVictoryService(
      progressRepository,
      trainerStateStore,
    );

    const result = await service.recordVictory(
      TRAINER_ID,
      'gym-leader-brock',
    );

    expect(recordFirstVictory).toHaveBeenCalledWith({
      trainerId: TRAINER_ID,
      trainerBattleId: 'gym-leader-brock',
      rewardItems: [{ itemId: 'super-potion', quantity: 2 }],
      rewardMoney: 1_800,
      gymBadgeId: 'boulder-badge',
    });
    expect(result.gymBadgeAward).toEqual({
      badgeId: 'boulder-badge',
      displayName: 'Boulder Badge',
    });
    expect(result.trainerState.earnedGymBadgeIds).toEqual([
      'boulder-badge',
    ]);
    expect(result.trainerState.defeatedTrainerBattleIds).toContain(
      'gym-leader-brock',
    );
  });

  it('hydrates persisted Gym badge ids through the repository', async () => {
    const trainerStateStore = new PokemonTrainerStateStore();
    const loadEarnedGymBadgeIds = vi
      .fn()
      .mockResolvedValue(['boulder-badge']);

    const progressRepository = {
      recordFirstVictory: vi.fn(),
      loadDefeatedTrainerBattleIds: vi.fn().mockResolvedValue([]),
      loadEarnedGymBadgeIds,
    } as unknown as PokemonTrainerBattleProgressRepository;

    const service = new PokemonTrainerBattleVictoryService(
      progressRepository,
      trainerStateStore,
    );

    await expect(service.loadEarnedGymBadgeIds(TRAINER_ID)).resolves.toEqual([
      'boulder-badge',
    ]);
  });
});
