import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '#app/database/prisma.service';
import type { PokemonTrainerId } from '#app/pokemon/pokemon-trainer-identity';

import { PlayerRecoveryCheckpointRepository } from '../player-recovery-checkpoint.repository';

const trainerId = 'trainer-recovery-repository-test' as PokemonTrainerId;

describe('PlayerRecoveryCheckpointRepository', () => {
  it('loads the dedicated recovery fields', async () => {
    const findUnique = vi.fn(async () => ({
      recoveryMapId: 'town-01',
      recoveryX: 512,
      recoveryY: 400,
      recoveryDirection: 'down',
    }));

    const prisma = {
      pokemonTrainer: {
        findUnique,
        update: vi.fn(),
      },
    } as unknown as PrismaService;

    const repository = new PlayerRecoveryCheckpointRepository(prisma);

    await expect(repository.load(trainerId)).resolves.toEqual({
      mapId: 'town-01',
      x: 512,
      y: 400,
      direction: 'down',
    });

    expect(findUnique).toHaveBeenCalledWith({
      where: {
        id: trainerId,
      },
      select: {
        recoveryMapId: true,
        recoveryX: true,
        recoveryY: true,
        recoveryDirection: true,
      },
    });
  });

  it('returns undefined when the Trainer does not exist', async () => {
    const prisma = {
      pokemonTrainer: {
        findUnique: vi.fn(async () => null),
        update: vi.fn(),
      },
    } as unknown as PrismaService;

    const repository = new PlayerRecoveryCheckpointRepository(prisma);

    await expect(repository.load(trainerId)).resolves.toBeUndefined();
  });

  it('persists recovery independently from current world location', async () => {
    const update = vi.fn(async () => ({}));

    const prisma = {
      pokemonTrainer: {
        findUnique: vi.fn(),
        update,
      },
    } as unknown as PrismaService;

    const repository = new PlayerRecoveryCheckpointRepository(prisma);

    await repository.save(trainerId, {
      mapId: 'poke-center',
      x: 256,
      y: 344,
      direction: 'up',
    });

    expect(update).toHaveBeenCalledWith({
      where: {
        id: trainerId,
      },
      data: {
        recoveryMapId: 'poke-center',
        recoveryX: 256,
        recoveryY: 344,
        recoveryDirection: 'up',
      },
    });
  });
});
