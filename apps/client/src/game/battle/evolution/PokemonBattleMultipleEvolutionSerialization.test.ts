import { describe, expect, it } from "vitest";

import type { PokemonBattleTurnResolvedPayload } from "@cesar-mmo/shared";

import { BattlePresentationQueue } from "../presentation/BattlePresentationQueue";

import { PokemonEvolutionPresentationController } from "./PokemonEvolutionPresentationController";

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

describe("multiple Evolution serialization", () => {
  it("shows Pokémon B after Pokémon A cancels its Evolution", async () => {
    const order: string[] = [];

    const queueIdle = createDeferred<void>();

    let evolutionController!: PokemonEvolutionPresentationController;

    evolutionController = new PokemonEvolutionPresentationController({
      requestDecision: async (input) => {
        order.push(`prompt:${input.pokemonInstanceId}`);

        /*
         * This reproduces the runtime
         * case we just found:
         *
         * A → CANCEL
         * B → CANCEL
         *
         * What matters is proving that
         * B is still presented.
         */
        return {
          type: "cancel",
        };
      },

      sendDecision: (input) => {
        order.push(
          ["send", input.pokemonInstanceId, input.decision.type].join(":"),
        );

        /*
         * Simulate authoritative server
         * acknowledgement.
         *
         * queueMicrotask guarantees the
         * response arrives after
         * waitForResponse() has already
         * been registered.
         */
        queueMicrotask(() => {
          evolutionController.applyResolved({
            pokemonInstanceId: input.pokemonInstanceId,

            resolvedRevision: input.revision,

            decision: input.decision,

            evolution: null,
          });
        });
      },

      hideDecision: () => {
        // Visual concern only.
      },

      animateEvolution: async () => {
        /*
         * CANCEL must never animate.
         */
        order.push("unexpected-animation");
      },
    });

    const queue = new BattlePresentationQueue({
      presentEvent: async (event) => {
        if (event.type !== "evolution-required") {
          return;
        }

        order.push(`event-start:${event.pokemonInstanceId}`);

        await evolutionController.presentRequiredEvolution(event);

        order.push(`event-end:${event.pokemonInstanceId}`);
      },

      onTurnCompleted: () => {
        order.push("turn-completed");
      },

      onIdle: () => {
        order.push("queue-idle");

        queueIdle.resolve();
      },
    });

    const payload: PokemonBattleTurnResolvedPayload = {
      battleId: "battle-multiple-evolution",

      turnNumber: 1,

      events: [
        {
          type: "evolution-required",

          participantId: "trainer-participant",

          pokemonInstanceId: "pokemon-a",

          sourceSpeciesId: 4,

          sourceFormId: 4,

          targetSpeciesId: 5,

          targetFormId: 5,

          triggerLevel: 16,

          revision: 0,
        },

        {
          type: "evolution-required",

          participantId: "trainer-participant",

          pokemonInstanceId: "pokemon-b",

          sourceSpeciesId: 7,

          sourceFormId: 7,

          targetSpeciesId: 8,

          targetFormId: 8,

          triggerLevel: 16,

          revision: 0,
        },
      ],
    };

    queue.enqueue(payload);

    await queueIdle.promise;

    expect(order).toEqual([
      "event-start:pokemon-a",
      "prompt:pokemon-a",
      "send:pokemon-a:cancel",
      "event-end:pokemon-a",

      /*
       * This is the regression
       * requirement.
       */
      "event-start:pokemon-b",
      "prompt:pokemon-b",
      "send:pokemon-b:cancel",
      "event-end:pokemon-b",

      "turn-completed",
      "queue-idle",
    ]);

    expect(order).not.toContain("unexpected-animation");
  });
});
