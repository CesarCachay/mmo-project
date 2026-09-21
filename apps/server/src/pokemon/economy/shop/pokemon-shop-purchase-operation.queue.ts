import { Injectable } from '@nestjs/common';

import type { PokemonTrainerId } from '../../pokemon-trainer-identity';

@Injectable()
export class PokemonShopPurchaseOperationQueue {
  private readonly queues = new Map<PokemonTrainerId, Promise<void>>();

  public async waitForIdle(trainerId: PokemonTrainerId): Promise<void> {
    const pending = this.queues.get(trainerId);

    if (!pending) {
      return;
    }

    await pending.catch(() => undefined);
  }

  public enqueue<T>(
    trainerId: PokemonTrainerId,
    operation: () => Promise<T>,
  ): Promise<T> {
    const previous = this.queues.get(trainerId) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);

    const tail: Promise<void> = current.then(
      () => undefined,
      () => undefined,
    );

    this.queues.set(trainerId, tail);

    void tail.finally(() => {
      if (this.queues.get(trainerId) === tail) {
        this.queues.delete(trainerId);
      }
    });

    return current;
  }
}
