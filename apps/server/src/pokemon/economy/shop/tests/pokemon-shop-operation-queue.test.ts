import { describe, expect, it } from 'vitest';

import type { PokemonTrainerId } from '#app/pokemon/pokemon-trainer-identity';
import { PokemonShopPurchaseOperationQueue } from '../pokemon-shop-purchase-operation.queue';

const TRAINER_ID = '44444444-4444-4444-8444-444444444444' as PokemonTrainerId;

describe('PokemonShopPurchaseOperationQueue', () => {
  it('waitForIdle resolves only after the current Trainer transaction settles', async () => {
    const queue = new PokemonShopPurchaseOperationQueue();
    let release!: () => void;
    let markStarted!: () => void;
    let idle = false;

    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });

    const operation = queue.enqueue(
      TRAINER_ID,
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
          markStarted();
        }),
    );

    const waiting = queue.waitForIdle(TRAINER_ID).then(() => {
      idle = true;
    });

    // Do not rely on a fixed number of microtask turns. The queue may add
    // promise links before invoking the operation, so wait for an explicit
    // signal that the operation has actually started and assigned `release`.
    await started;

    expect(idle).toBe(false);

    release();
    await operation;
    await waiting;

    expect(idle).toBe(true);
  });
});
