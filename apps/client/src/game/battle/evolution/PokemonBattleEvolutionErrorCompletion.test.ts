import { describe, expect, it, vi } from "vitest";

import type {
  BattlePresentationEvent,
  PokemonBattleTurnResolvedPayload,
  PokemonEvolutionDecision,
} from "@cesar-mmo/shared";

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

function createEvolutionRequiredEvent(): Extract<
  BattlePresentationEvent,
  {
    readonly type: "evolution-required";
  }
> {
  return {
    type: "evolution-required",

    participantId: "trainer-participant",

    pokemonInstanceId: "pokemon-a",

    sourceSpeciesId: 1,

    sourceFormId: 1,

    targetSpeciesId: 2,

    targetFormId: 2,

    triggerLevel: 16,

    revision: 0,
  };
}

function createTurn(
  event: BattlePresentationEvent,
): PokemonBattleTurnResolvedPayload {
  return {
    battleId: "battle-a",

    turnNumber: 3,

    events: [event],
  };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("Battle Evolution error completion serialization", () => {
  it("does not reach Victory when EVOLUTION_ERROR rejects the authoritative decision", async () => {
    const decisionOpened = createDeferred<void>();

    const decision = createDeferred<PokemonEvolutionDecision>();

    const decisionSent = createDeferred<void>();

    const hideDecision = vi.fn();

    const animateEvolution = vi.fn(() => Promise.resolve());

    const showCompletion = vi.fn();

    const onTurnCompleted = vi.fn();

    let evolutionController!: PokemonEvolutionPresentationController;

    const sendDecision = vi.fn((input) => {
      /*
       * Simulate the real server:
       *
       * EVOLUTION_DECISION
       * ↓
       * EVOLUTION_ERROR
       */
      evolutionController.applyError({
        pokemonInstanceId: input.pokemonInstanceId,

        revision: input.revision,

        code: "PERSISTENCE_CONFLICT",

        message: "Forced integration test conflict",
      });

      decisionSent.resolve();
    });

    evolutionController = new PokemonEvolutionPresentationController({
      sendDecision,

      requestDecision: async () => {
        decisionOpened.resolve();

        return decision.promise;
      },

      hideDecision,

      animateEvolution,
    });

    /*
     * Minimal representation of
     * BattleController.pendingCompletion.
     */
    let pendingCompletion = false;

    const queue = new BattlePresentationQueue({
      presentEvent: async (event) => {
        if (event.type !== "evolution-required") {
          return;
        }

        await evolutionController.presentRequiredEvolution(event);
      },

      onTurnCompleted: async () => {
        onTurnCompleted();
      },

      onIdle: () => {
        /*
         * Equivalent conceptual gate:
         *
         * BattleController only commits
         * pending Victory when the
         * presentation system reaches
         * idle.
         */
        if (pendingCompletion) {
          showCompletion();
        }
      },
    });

    queue.enqueue(createTurn(createEvolutionRequiredEvent()));

    /*
     * Evolution prompt is now waiting
     * for the player's choice.
     */
    await decisionOpened.promise;

    expect(queue.isBusy).toBe(true);

    /*
     * Simulate BATTLE_COMPLETED arriving
     * while Evolution is still unresolved.
     */
    pendingCompletion = true;

    expect(showCompletion).not.toHaveBeenCalled();

    /*
     * Player chooses CANCEL.
     *
     * CANCEL itself is not the failure.
     * The authoritative server response
     * will be.
     */
    decision.resolve({
      type: "cancel",
    });

    await decisionSent.promise;

    /*
     * Let:
     *
     * applyError()
     * -> responsePromise reject
     * -> presentRequiredEvolution reject
     * -> presentTurn reject
     * -> drain block
     */
    await flushPromises();

    expect(sendDecision).toHaveBeenCalledTimes(1);

    expect(queue.isBlocked).toBe(true);

    expect(queue.isBusy).toBe(true);

    expect(onTurnCompleted).not.toHaveBeenCalled();

    expect(showCompletion).not.toHaveBeenCalled();

    /*
     * No ACCEPT occurred, therefore
     * Evolution cinematic must never run.
     */
    expect(animateEvolution).not.toHaveBeenCalled();

    /*
     * Error cleanup still hides the
     * decision UI.
     */
    expect(hideDecision).toHaveBeenCalled();

    evolutionController.destroy();
  });
});
