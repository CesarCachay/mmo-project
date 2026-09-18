import { DEFAULT_MAP_ID, MAP_DATA_REGISTRY } from '@cesar-mmo/shared';

import { describe, expect, it, vi } from 'vitest';

import type { PokemonTrainerId } from '#app/pokemon/pokemon-trainer-identity';

import type { PlayerRecoveryCheckpointRepository } from '../player-recovery-checkpoint.repository';
import { PlayerRecoveryCheckpointService } from '../player-recovery-checkpoint.service';

const trainerId = 'trainer-recovery-service-test' as PokemonTrainerId;

function createHarness(
  persisted: Awaited<
    ReturnType<PlayerRecoveryCheckpointRepository['load']>
  > = {
    mapId: null,
    x: null,
    y: null,
    direction: null,
  },
) {
  const load = vi.fn(async () => persisted);
  const save = vi.fn(async () => undefined);

  const repository = {
    load,
    save,
  } as unknown as PlayerRecoveryCheckpointRepository;

  const service = new PlayerRecoveryCheckpointService(repository);

  return {
    service,
    load,
    save,
  };
}

function getExpectedFallback() {
  const map = MAP_DATA_REGISTRY[DEFAULT_MAP_ID];

  return {
    mapId: DEFAULT_MAP_ID,
    x: map.spawn.x,
    y: map.spawn.y,
    direction: 'down' as const,
  };
}

describe('PlayerRecoveryCheckpointService', () => {
  it('falls back to town-01 spawn when no Center checkpoint exists', async () => {
    const harness = createHarness();

    await expect(
      harness.service.loadRecoveryCheckpoint(trainerId),
    ).resolves.toEqual(getExpectedFallback());

    expect(harness.save).not.toHaveBeenCalled();
  });

  it('returns a valid persisted checkpoint', async () => {
    const harness = createHarness({
      mapId: 'poke-center',
      x: 256,
      y: 344,
      direction: 'up',
    });

    await expect(
      harness.service.loadRecoveryCheckpoint(trainerId),
    ).resolves.toEqual({
      mapId: 'poke-center',
      x: 256,
      y: 344,
      direction: 'up',
    });

    expect(harness.save).not.toHaveBeenCalled();
  });

  it('repairs an invalid persisted map to the town-01 fallback', async () => {
    const harness = createHarness({
      mapId: 'missing-map',
      x: 50,
      y: 50,
      direction: 'down',
    });

    const fallback = getExpectedFallback();

    await expect(
      harness.service.loadRecoveryCheckpoint(trainerId),
    ).resolves.toEqual(fallback);

    expect(harness.save).toHaveBeenCalledWith(trainerId, fallback);
  });

  it('repairs an invalid direction while preserving a valid checkpoint', async () => {
    const harness = createHarness({
      mapId: 'town-01',
      x: 512,
      y: 400,
      direction: 'sideways',
    });

    await expect(
      harness.service.loadRecoveryCheckpoint(trainerId),
    ).resolves.toEqual({
      mapId: 'town-01',
      x: 512,
      y: 400,
      direction: 'down',
    });

    expect(harness.save).toHaveBeenCalledWith(trainerId, {
      mapId: 'town-01',
      x: 512,
      y: 400,
      direction: 'down',
    });
  });

  it('rejects an out-of-bounds checkpoint before persistence', async () => {
    const harness = createHarness();

    await expect(
      harness.service.saveRecoveryCheckpoint(trainerId, {
        mapId: 'town-01',
        x: -1,
        y: 400,
        direction: 'down',
      }),
    ).rejects.toThrow('outside map bounds');

    expect(harness.save).not.toHaveBeenCalled();
  });

  it('serializes writes for the same Trainer', async () => {
    const harness = createHarness();

    let releaseFirst: (() => void) | undefined;

    const firstPending = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    harness.save
      .mockImplementationOnce(async () => firstPending)
      .mockImplementationOnce(async () => undefined);

    const first = harness.service.saveRecoveryCheckpoint(trainerId, {
      mapId: 'town-01',
      x: 512,
      y: 400,
      direction: 'down',
    });

    const second = harness.service.saveRecoveryCheckpoint(trainerId, {
      mapId: 'poke-center',
      x: 256,
      y: 344,
      direction: 'up',
    });

    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(harness.save).toHaveBeenCalledTimes(1);

    if (!releaseFirst) {
      throw new Error('Expected release callback');
    }

    releaseFirst();

    await Promise.all([first, second]);

    expect(harness.save).toHaveBeenCalledTimes(2);
  });
});
