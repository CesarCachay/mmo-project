import { describe, expect, it, vi } from "vitest";

import type { PokemonEvolutionRequiredPayload } from "@cesar-mmo/shared";

import { PokemonEvolutionRecoveryPresentationQueue } from "./PokemonEvolutionRecoveryPresentationQueue";

interface Deferred<T> {
  readonly promise: Promise<T>;

  readonly resolve: (value: T) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;

  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });

  return {
    promise,
    resolve,
  };
}

function evolutionRequired(
  pokemonInstanceId: string,

  revision: number,
): PokemonEvolutionRequiredPayload {
  return {
    pokemonInstanceId,

    sourceSpeciesId: 1,

    sourceFormId: 1,

    targetSpeciesId: 2,

    targetFormId: 2,

    triggerLevel: 16,

    revision,
  };
}

describe("PokemonEvolutionRecoveryPresentationQueue", () => {
  it("serializes multiple reconnect Evolution prompts", async () => {
    const order: string[] = [];

    const evolutionA = createDeferred<void>();

    const evolutionB = createDeferred<void>();

    const allDone = createDeferred<void>();

    const presentRequiredEvolution = vi.fn(
      (payload: PokemonEvolutionRequiredPayload): Promise<void> => {
        order.push(`start:${payload.pokemonInstanceId}`);

        if (payload.pokemonInstanceId === "pokemon-a") {
          return evolutionA.promise.then(() => {
            order.push("end:pokemon-a");
          });
        }

        if (payload.pokemonInstanceId === "pokemon-b") {
          return evolutionB.promise.then(() => {
            order.push("end:pokemon-b");

            allDone.resolve();
          });
        }

        return Promise.reject(new Error("Unexpected Pokémon"));
      },
    );

    const queue = new PokemonEvolutionRecoveryPresentationQueue({
      presentRequiredEvolution,
    });

    queue.enqueue(evolutionRequired("pokemon-a", 0));

    queue.enqueue(evolutionRequired("pokemon-b", 0));

    /*
     * A starts immediately.
     *
     * B MUST NOT start while A
     * is unresolved.
     */
    await Promise.resolve();

    expect(order).toEqual(["start:pokemon-a"]);

    expect(queue.pendingCount).toBe(2);

    evolutionA.resolve();

    await Promise.resolve();
    await Promise.resolve();

    expect(order).toEqual([
      "start:pokemon-a",
      "end:pokemon-a",
      "start:pokemon-b",
    ]);

    evolutionB.resolve();

    await allDone.promise;
    await Promise.resolve();

    expect(order).toEqual([
      "start:pokemon-a",
      "end:pokemon-a",
      "start:pokemon-b",
      "end:pokemon-b",
    ]);

    expect(queue.pendingCount).toBe(0);

    expect(queue.isBusy).toBe(false);
  });

  it("deduplicates the same Pokémon and revision", async () => {
    const completed = createDeferred<void>();

    const presentRequiredEvolution = vi.fn(
      (_payload: PokemonEvolutionRequiredPayload): Promise<void> => {
        completed.resolve();

        return Promise.resolve();
      },
    );

    const queue = new PokemonEvolutionRecoveryPresentationQueue({
      presentRequiredEvolution,
    });

    const payload = evolutionRequired("pokemon-a", 3);

    queue.enqueue(payload);
    queue.enqueue(payload);
    queue.enqueue({
      ...payload,
    });

    await completed.promise;
    await Promise.resolve();
    await Promise.resolve();

    expect(presentRequiredEvolution).toHaveBeenCalledTimes(1);

    expect(queue.pendingCount).toBe(0);
  });

  it("does not allow a later Evolution to overtake a failed one", async () => {
    const order: string[] = [];

    const error = new Error("Evolution request failed");

    const onError = vi.fn();

    const presentRequiredEvolution = vi.fn(
      (payload: PokemonEvolutionRequiredPayload): Promise<void> => {
        order.push(`start:${payload.pokemonInstanceId}`);

        if (payload.pokemonInstanceId === "pokemon-a") {
          return Promise.reject(error);
        }

        return Promise.resolve();
      },
    );

    const queue = new PokemonEvolutionRecoveryPresentationQueue({
      presentRequiredEvolution,
      onError,
    });

    queue.enqueue(evolutionRequired("pokemon-a", 0));

    queue.enqueue(evolutionRequired("pokemon-b", 0));

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(order).toEqual(["start:pokemon-a"]);

    expect(onError).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        pokemonInstanceId: "pokemon-a",
      }),
    );

    /*
     * A remains queued and B
     * cannot overtake it.
     */
    expect(queue.pendingCount).toBe(2);

    expect(queue.isBusy).toBe(true);
  });
});
