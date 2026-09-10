import { Injectable } from '@nestjs/common';

import type { PokemonTrainerId } from '../pokemon-trainer-identity';

@Injectable()
export class PokemonProgressionOperationQueue {
  private readonly queues = new Map<PokemonTrainerId, Promise<void>>();

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
