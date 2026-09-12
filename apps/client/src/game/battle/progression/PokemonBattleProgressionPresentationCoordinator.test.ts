import { describe, expect, it, vi } from "vitest";

import type {
  BattleMoveLearningRequiredEvent,
  PokemonEvolutionRequiredPayload,
  PokemonInstanceMove,
  PokemonMoveLearningResolvedPayload,
} from "@cesar-mmo/shared";

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

const moveLearningEvent: BattleMoveLearningRequiredEvent = {
  type: "move-learning-required",

  participantId: "trainer",

  pokemonInstanceId: "pokemon-a",

  candidateMoveId: 5,

  candidateLearnedAtLevel: 16,

  revision: 0,

  currentMoves,
};

const pendingEvolution: PokemonEvolutionRequiredPayload = {
  pokemonInstanceId: "pokemon-a",

  sourceSpeciesId: 4,
  sourceFormId: 4,

  targetSpeciesId: 5,
  targetFormId: 5,

  triggerLevel: 16,

  revision: 0,
};

describe("PokemonBattleProgressionPresentationCoordinator", () => {
  it("does not finish Move Learning workflow until embedded Evolution finishes", async () => {
    const order: string[] = [];

    const evolutionStarted = createDeferred<void>();

    const releaseEvolution = createDeferred<void>();

    const response: PokemonMoveLearningResolvedPayload = {
      pokemonInstanceId: "pokemon-a",

      resolvedCandidateMoveId: 5,

      resolvedRevision: 0,

      decision: {
        type: "cancel",
      },

      currentMoves,

      nextPending: null,

      pendingEvolution,
    };

    const coordinator = new PokemonBattleProgressionPresentationCoordinator({
      presentMessage: async () => {
        // presentation intentionally instant
      },

      requestMoveLearningDecision: async () => ({
        type: "cancel",
      }),

      hideMoveLearning: () => {
        // no DOM in this unit test
      },

      sendMoveLearningDecision: vi.fn(),

      waitForMoveLearningResponse: async () => response,

      presentRequiredEvolution: async (evolution) => {
        order.push(`evolution-start:${evolution.pokemonInstanceId}`);

        evolutionStarted.resolve(undefined);

        await releaseEvolution.promise;

        order.push(`evolution-end:${evolution.pokemonInstanceId}`);
      },
    });

    const workflowPromise = coordinator
      .presentMoveLearningWorkflow({
        pokemonName: "Charmander",

        event: moveLearningEvent,
      })
      .then(() => {
        order.push("workflow-end");
      });

    /*
     * Wait until Evolution has actually
     * started and deliberately keep it
     * blocked.
     */
    await evolutionStarted.promise;

    expect(order).toEqual(["evolution-start:pokemon-a"]);

    /*
     * Most important assertion:
     *
     * the parent Move Learning workflow
     * MUST still be pending.
     */
    expect(order).not.toContain("workflow-end");

    releaseEvolution.resolve(undefined);

    await workflowPromise;

    expect(order).toEqual([
      "evolution-start:pokemon-a",
      "evolution-end:pokemon-a",
      "workflow-end",
    ]);
  });
});
