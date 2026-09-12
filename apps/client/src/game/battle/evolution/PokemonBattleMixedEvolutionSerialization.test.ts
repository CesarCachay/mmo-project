import { describe, expect, it } from "vitest";

import type {
  PokemonBattleTurnResolvedPayload,
  PokemonMoveLearningResolvedPayload,
} from "@cesar-mmo/shared";

import { BattlePresentationQueue } from "../presentation/BattlePresentationQueue";

import { PokemonBattleProgressionPresentationCoordinator } from "../progression/PokemonBattleProgressionPresentationCoordinator";

import { PokemonEvolutionPresentationController } from "./PokemonEvolutionPresentationController";

import { PokemonBattleEvolutionHudSyncCoordinator } from "./PokemonBattleEvolutionHudSyncCoordinator";

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

describe("mixed Move Learning and Evolution serialization", () => {
  it("shows Pokémon B after cancelling Pokémon A Evolution created by Move Learning", async () => {
    const order: string[] = [];

    const queueIdle = createDeferred<void>();

    let evolutionController!: PokemonEvolutionPresentationController;

    evolutionController = new PokemonEvolutionPresentationController({
      requestDecision: async (input) => {
        order.push(`evolution-prompt:${input.pokemonInstanceId}`);

        /*
         * Critical scenario:
         *
         * Evolution A -> CANCEL
         * Evolution B -> CANCEL
         */
        return {
          type: "cancel",
        };
      },

      sendDecision: (input) => {
        order.push(
          ["evolution-send", input.pokemonInstanceId, input.decision.type].join(
            ":",
          ),
        );

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
        // Visual-only concern.
      },

      animateEvolution: async () => {
        order.push("unexpected-animation");
      },
    });

    const evolutionCoordinator = new PokemonBattleEvolutionHudSyncCoordinator({
      presentRequiredEvolution: (payload) =>
        evolutionController.presentRequiredEvolution(payload),

      /*
       * CANCEL does not require
       * authoritative HUD sync.
       */
      getTrainerState: () => undefined,

      syncTrainerPokemonAfterEvolution: () => {
        order.push("unexpected-hud-sync");
      },

      finishEvolutionCinematic: () => {
        // Safe even when Evolution was cancelled.
      },
    });

    const progressionCoordinator =
      new PokemonBattleProgressionPresentationCoordinator({
        presentMessage: async () => {
          // Presentation timing is irrelevant here.
        },

        requestMoveLearningDecision: async (input) => {
          order.push(`move-learning-prompt:${input.pokemonName}`);

          /*
           * Resolve Move Learning itself.
           *
           * The important part is that the
           * authoritative response creates
           * pendingEvolution A.
           */
          return {
            type: "cancel",
          };
        },

        hideMoveLearning: () => {
          // Visual-only concern.
        },

        sendMoveLearningDecision: (input) => {
          order.push(
            [
              "move-learning-send",
              input.pokemonInstanceId,
              input.decision.type,
            ].join(":"),
          );
        },

        waitForMoveLearningResponse: async (
          pokemonInstanceId,
          revision,
        ): Promise<PokemonMoveLearningResolvedPayload> => {
          expect(pokemonInstanceId).toBe("pokemon-a");

          expect(revision).toBe(0);

          return {
            pokemonInstanceId: "pokemon-a",

            resolvedCandidateMoveId: 33,

            resolvedRevision: 0,

            decision: {
              type: "cancel",
            },

            currentMoves: [
              {
                moveId: 10,
                currentPp: 35,
              },
              {
                moveId: 45,
                currentPp: 40,
              },
              {
                moveId: 52,
                currentPp: 25,
              },
              {
                moveId: 98,
                currentPp: 30,
              },
            ],

            nextPending: null,

            /*
             * THIS is the Evolution
             * created after A finishes
             * Move Learning.
             */
            pendingEvolution: {
              pokemonInstanceId: "pokemon-a",

              sourceSpeciesId: 1,

              sourceFormId: 1,

              targetSpeciesId: 2,

              targetFormId: 2,

              triggerLevel: 16,

              revision: 0,
            },
          };
        },

        presentRequiredEvolution: async (payload) => {
          await evolutionCoordinator.presentRequiredEvolution(payload);
        },
      });

    const queue = new BattlePresentationQueue({
      presentEvent: async (event) => {
        if (event.type === "move-learning-required") {
          await progressionCoordinator.presentMoveLearningWorkflow({
            pokemonName: "Pokémon A",

            event,
          });

          return;
        }

        if (event.type === "evolution-required") {
          await evolutionCoordinator.presentRequiredEvolution(event);
        }
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
      battleId: "battle-mixed-evolution",

      turnNumber: 1,

      events: [
        /*
         * Pokémon A does NOT receive a
         * direct evolution-required event.
         *
         * Its Evolution comes from the
         * Move Learning response.
         */
        {
          type: "move-learning-required",

          participantId: "trainer-participant",

          pokemonInstanceId: "pokemon-a",

          candidateMoveId: 33,

          candidateLearnedAtLevel: 16,

          revision: 0,

          currentMoves: [
            {
              moveId: 10,
              currentPp: 35,
            },
            {
              moveId: 45,
              currentPp: 40,
            },
            {
              moveId: 52,
              currentPp: 25,
            },
            {
              moveId: 98,
              currentPp: 30,
            },
          ],
        },

        /*
         * Pokémon B already has a direct
         * pending Evolution from Party
         * progression.
         */
        {
          type: "evolution-required",

          participantId: "trainer-participant",

          pokemonInstanceId: "pokemon-b",

          sourceSpeciesId: 4,

          sourceFormId: 4,

          targetSpeciesId: 5,

          targetFormId: 5,

          triggerLevel: 16,

          revision: 0,
        },
      ],
    };

    queue.enqueue(payload);

    await queueIdle.promise;

    expect(order).toEqual([
      "move-learning-prompt:Pokémon A",
      "move-learning-send:pokemon-a:cancel",

      /*
       * Evolution A generated by
       * Move Learning continuation.
       */
      "evolution-prompt:pokemon-a",
      "evolution-send:pokemon-a:cancel",

      /*
       * Critical regression:
       *
       * cancelling A MUST NOT consume,
       * skip or hide B.
       */
      "evolution-prompt:pokemon-b",
      "evolution-send:pokemon-b:cancel",

      "turn-completed",
      "queue-idle",
    ]);

    expect(order).not.toContain("unexpected-animation");

    expect(order).not.toContain("unexpected-hud-sync");
  });
});
