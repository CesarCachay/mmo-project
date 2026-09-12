import { describe, expect, it } from "vitest";

import type {
  PokemonBattleTurnResolvedPayload,
  PokemonEvolutionRequiredPayload,
  PokemonInstanceMove,
  PokemonMoveLearningResolvedPayload,
} from "@cesar-mmo/shared";

import { BattlePresentationQueue } from "../presentation/BattlePresentationQueue";

import { PokemonBattleProgressionPresentationCoordinator } from "./PokemonBattleProgressionPresentationCoordinator";

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

const currentMoves: readonly PokemonInstanceMove[] = [
  {
    moveId: 1,
    currentPp: 35,
  },
  {
    moveId: 2,
    currentPp: 25,
  },
  {
    moveId: 3,
    currentPp: 20,
  },
  {
    moveId: 4,
    currentPp: 15,
  },
];

const evolutionA: PokemonEvolutionRequiredPayload = {
  pokemonInstanceId: "pokemon-a",

  sourceSpeciesId: 4,
  sourceFormId: 4,

  targetSpeciesId: 5,
  targetFormId: 5,

  triggerLevel: 16,

  revision: 0,
};

describe("Battle progression presentation serialization", () => {
  it("does not start Pokémon B while Pokémon A Evolution is still pending", async () => {
    const order: string[] = [];

    /*
     * We intentionally freeze A's
     * Evolution in the middle.
     */
    const evolutionAStarted = createDeferred<void>();

    const releaseEvolutionA = createDeferred<void>();

    const queueIdle = createDeferred<void>();

    /*
     * Same Evolution presenter is used
     * for:
     *
     * - A embedded Evolution
     * - C direct Evolution
     */
    const presentEvolution = async (
      payload: PokemonEvolutionRequiredPayload,
    ): Promise<void> => {
      order.push(`evolution-start:${payload.pokemonInstanceId}`);

      if (payload.pokemonInstanceId === "pokemon-a") {
        evolutionAStarted.resolve(undefined);

        await releaseEvolutionA.promise;
      }

      order.push(`evolution-end:${payload.pokemonInstanceId}`);
    };

    const coordinator = new PokemonBattleProgressionPresentationCoordinator({
      presentMessage: () => Promise.resolve(),

      requestMoveLearningDecision: (input) => {
        order.push(`move-start:${input.pokemonName}`);

        return Promise.resolve({
          type: "cancel",
        });
      },

      hideMoveLearning: () => {
        // No DOM in this test.
      },

      sendMoveLearningDecision: () => {
        // Network emit is not required here.
      },

      waitForMoveLearningResponse: (pokemonInstanceId, revision) => {
        if (pokemonInstanceId === "pokemon-a") {
          const response: PokemonMoveLearningResolvedPayload = {
            pokemonInstanceId,

            resolvedCandidateMoveId: 101,

            resolvedRevision: revision,

            decision: {
              type: "cancel",
            },

            currentMoves,

            nextPending: null,

            pendingEvolution: evolutionA,
          };

          return Promise.resolve(response);
        }

        if (pokemonInstanceId === "pokemon-b") {
          const response: PokemonMoveLearningResolvedPayload = {
            pokemonInstanceId,

            resolvedCandidateMoveId: 102,

            resolvedRevision: revision,

            decision: {
              type: "cancel",
            },

            currentMoves,

            nextPending: null,

            pendingEvolution: null,
          };

          return Promise.resolve(response);
        }

        return Promise.reject(
          new Error(`Unexpected Move Learning Pokémon "${pokemonInstanceId}"`),
        );
      },

      presentRequiredEvolution: presentEvolution,
    });

    /*
     * Real BattlePresentationQueue.
     */
    const queue = new BattlePresentationQueue({
      presentEvent: async (event) => {
        if (event.type === "move-learning-required") {
          /*
           * Using instanceId as the
           * display name keeps this
           * integration test deterministic.
           */
          await coordinator.presentMoveLearningWorkflow({
            pokemonName: event.pokemonInstanceId,

            event,
          });

          order.push(`move-end:${event.pokemonInstanceId}`);

          return;
        }

        if (event.type === "evolution-required") {
          await presentEvolution(event);

          return;
        }

        throw new Error(`Unexpected presentation event "${event.type}"`);
      },

      onTurnCompleted: () => {
        order.push("turn-completed");
      },

      onIdle: () => {
        order.push("queue-idle");

        queueIdle.resolve(undefined);
      },
    });

    const turn: PokemonBattleTurnResolvedPayload = {
      battleId: "battle-test",

      turnNumber: 1,

      events: [
        /*
         * Pokémon A:
         * Move Learning -> Evolution.
         */
        {
          type: "move-learning-required",

          participantId: "trainer-test",

          pokemonInstanceId: "pokemon-a",

          candidateMoveId: 101,

          candidateLearnedAtLevel: 16,

          revision: 0,

          currentMoves,
        },

        /*
         * Pokémon B:
         * Move Learning only.
         */
        {
          type: "move-learning-required",

          participantId: "trainer-test",

          pokemonInstanceId: "pokemon-b",

          candidateMoveId: 102,

          candidateLearnedAtLevel: 17,

          revision: 0,

          currentMoves,
        },

        /*
         * Pokémon C:
         * direct Evolution.
         */
        {
          type: "evolution-required",

          participantId: "trainer-test",

          pokemonInstanceId: "pokemon-c",

          sourceSpeciesId: 7,

          sourceFormId: 7,

          targetSpeciesId: 8,

          targetFormId: 8,

          triggerLevel: 16,

          revision: 0,
        },
      ],
    };

    queue.enqueue(turn);

    /*
     * Wait until Pokémon A reaches
     * Evolution.
     *
     * Evolution is now deliberately
     * blocked.
     */
    await evolutionAStarted.promise;

    /*
     * This is the critical assertion.
     *
     * B must NOT have started.
     * C must NOT have started.
     * Turn must NOT have completed.
     */
    expect(order).toEqual([
      "move-start:pokemon-a",
      "evolution-start:pokemon-a",
    ]);

    expect(queue.isBusy).toBe(true);

    expect(order).not.toContain("move-start:pokemon-b");

    expect(order).not.toContain("evolution-start:pokemon-c");

    expect(order).not.toContain("turn-completed");

    /*
     * Allow Pokémon A Evolution
     * to finish.
     */
    releaseEvolutionA.resolve(undefined);

    /*
     * Wait until the REAL queue has
     * consumed everything.
     */
    await queueIdle.promise;

    expect(order).toEqual([
      "move-start:pokemon-a",

      "evolution-start:pokemon-a",
      "evolution-end:pokemon-a",

      "move-end:pokemon-a",

      "move-start:pokemon-b",
      "move-end:pokemon-b",

      "evolution-start:pokemon-c",
      "evolution-end:pokemon-c",

      "turn-completed",
      "queue-idle",
    ]);

    expect(queue.isBusy).toBe(false);
  });

  it("completes every pending Move Learning decision before Evolution and the next Pokémon", async () => {
    const order: string[] = [];

    const evolutionAStarted = createDeferred<void>();

    const releaseEvolutionA = createDeferred<void>();

    const queueIdle = createDeferred<void>();

    const evolutionA: PokemonEvolutionRequiredPayload = {
      pokemonInstanceId: "pokemon-a",

      sourceSpeciesId: 4,
      sourceFormId: 4,

      targetSpeciesId: 5,
      targetFormId: 5,

      triggerLevel: 17,

      revision: 0,
    };

    const presentEvolution = async (
      payload: PokemonEvolutionRequiredPayload,
    ): Promise<void> => {
      order.push(`evolution-start:${payload.pokemonInstanceId}`);

      if (payload.pokemonInstanceId === "pokemon-a") {
        evolutionAStarted.resolve(undefined);

        await releaseEvolutionA.promise;
      }

      order.push(`evolution-end:${payload.pokemonInstanceId}`);
    };

    const coordinator = new PokemonBattleProgressionPresentationCoordinator({
      presentMessage: () => Promise.resolve(),

      requestMoveLearningDecision: (input) => {
        order.push(`move-prompt:${input.pokemonName}:${input.candidateMoveId}`);

        return Promise.resolve({
          type: "cancel",
        });
      },

      hideMoveLearning: () => {
        // No DOM in this test.
      },

      sendMoveLearningDecision: () => {
        // Network transport is not relevant here.
      },

      waitForMoveLearningResponse: (pokemonInstanceId, revision) => {
        /*
         * Pokémon A — first pending move.
         *
         * Important:
         * there is another Move Learning
         * decision, therefore Evolution
         * MUST still be null.
         */
        if (pokemonInstanceId === "pokemon-a" && revision === 0) {
          const response: PokemonMoveLearningResolvedPayload = {
            pokemonInstanceId,

            resolvedCandidateMoveId: 201,

            resolvedRevision: 0,

            decision: {
              type: "cancel",
            },

            currentMoves,

            nextPending: {
              pokemonInstanceId,

              candidateMoveId: 202,

              candidateLearnedAtLevel: 17,

              revision: 1,

              currentMoves,
            },

            pendingEvolution: null,
          };

          return Promise.resolve(response);
        }

        /*
         * Pokémon A — second/final move.
         *
         * Move Learning is now completely
         * finished, so Evolution may appear.
         */
        if (pokemonInstanceId === "pokemon-a" && revision === 1) {
          const response: PokemonMoveLearningResolvedPayload = {
            pokemonInstanceId,

            resolvedCandidateMoveId: 202,

            resolvedRevision: 1,

            decision: {
              type: "cancel",
            },

            currentMoves,

            nextPending: null,

            pendingEvolution: evolutionA,
          };

          return Promise.resolve(response);
        }

        /*
         * Pokémon B — one Move Learning,
         * no Evolution.
         */
        if (pokemonInstanceId === "pokemon-b" && revision === 0) {
          const response: PokemonMoveLearningResolvedPayload = {
            pokemonInstanceId,

            resolvedCandidateMoveId: 301,

            resolvedRevision: 0,

            decision: {
              type: "cancel",
            },

            currentMoves,

            nextPending: null,

            pendingEvolution: null,
          };

          return Promise.resolve(response);
        }

        return Promise.reject(
          new Error(
            `Unexpected Move Learning state: ${pokemonInstanceId} revision=${revision}`,
          ),
        );
      },

      presentRequiredEvolution: presentEvolution,
    });

    const queue = new BattlePresentationQueue({
      presentEvent: async (event) => {
        if (event.type === "move-learning-required") {
          await coordinator.presentMoveLearningWorkflow({
            pokemonName: event.pokemonInstanceId,

            event,
          });

          order.push(`move-end:${event.pokemonInstanceId}`);

          return;
        }

        if (event.type === "evolution-required") {
          await presentEvolution(event);

          return;
        }

        throw new Error(`Unexpected presentation event "${event.type}"`);
      },

      onTurnCompleted: () => {
        order.push("turn-completed");
      },

      onIdle: () => {
        order.push("queue-idle");

        queueIdle.resolve(undefined);
      },
    });

    const turn: PokemonBattleTurnResolvedPayload = {
      battleId: "battle-multiple-moves",

      turnNumber: 1,

      events: [
        /*
         * Only the FIRST Move Learning
         * decision is present in the Battle
         * presentation event.
         *
         * The second one comes from
         * response.nextPending.
         */
        {
          type: "move-learning-required",

          participantId: "trainer-test",

          pokemonInstanceId: "pokemon-a",

          candidateMoveId: 201,

          candidateLearnedAtLevel: 16,

          revision: 0,

          currentMoves,
        },

        {
          type: "move-learning-required",

          participantId: "trainer-test",

          pokemonInstanceId: "pokemon-b",

          candidateMoveId: 301,

          candidateLearnedAtLevel: 18,

          revision: 0,

          currentMoves,
        },

        {
          type: "evolution-required",

          participantId: "trainer-test",

          pokemonInstanceId: "pokemon-c",

          sourceSpeciesId: 7,

          sourceFormId: 7,

          targetSpeciesId: 8,

          targetFormId: 8,

          triggerLevel: 16,

          revision: 0,
        },
      ],
    };

    queue.enqueue(turn);

    /*
     * Wait until A reaches Evolution.
     *
     * To reach this point A MUST already
     * have consumed both Move Learning
     * decisions.
     */
    await evolutionAStarted.promise;

    expect(order).toEqual([
      "move-prompt:pokemon-a:201",
      "move-prompt:pokemon-a:202",
      "evolution-start:pokemon-a",
    ]);

    /*
     * Critical guarantees while A's
     * Evolution is blocked.
     */
    expect(order).not.toContain("move-prompt:pokemon-b:301");

    expect(order).not.toContain("evolution-start:pokemon-c");

    expect(order).not.toContain("turn-completed");

    expect(queue.isBusy).toBe(true);

    /*
     * Finish A Evolution.
     */
    releaseEvolutionA.resolve(undefined);

    await queueIdle.promise;

    expect(order).toEqual([
      /*
       * A completes ALL Move Learning first.
       */
      "move-prompt:pokemon-a:201",
      "move-prompt:pokemon-a:202",

      /*
       * Then A evolves.
       */
      "evolution-start:pokemon-a",
      "evolution-end:pokemon-a",

      "move-end:pokemon-a",

      /*
       * Only now can B begin.
       */
      "move-prompt:pokemon-b:301",
      "move-end:pokemon-b",

      /*
       * Direct Evolution remains after
       * Move Learning phase.
       */
      "evolution-start:pokemon-c",
      "evolution-end:pokemon-c",

      "turn-completed",
      "queue-idle",
    ]);

    expect(queue.isBusy).toBe(false);
  });
});
