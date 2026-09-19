import { describe, expect, it, vi } from "vitest";

import type {
  BattlePresentationEvent,
  PokemonBattleTurnResolvedPayload,
} from "@cesar-mmo/shared";

import {
  BattlePresentationQueue,
  type BattlePresentationEventContext,
} from "./BattlePresentationQueue";

interface Deferred {
  readonly promise: Promise<void>;

  readonly resolve: () => void;
}

function createDeferred(): Deferred {
  let resolve!: () => void;

  const promise = new Promise<void>((resolver) => {
    resolve = resolver;
  });

  return {
    promise,
    resolve,
  };
}

function createEvolutionRequiredEvent(): BattlePresentationEvent {
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

function createLevelUpEvent(): BattlePresentationEvent {
  return {
    type: "pokemon-leveled-up",

    participantId: "trainer-participant",

    pokemonInstanceId: "pokemon-a",

    previousLevel: 15,

    currentLevel: 16,
  };
}

function createTurn(
  events: readonly BattlePresentationEvent[],
): PokemonBattleTurnResolvedPayload {
  return {
    battleId: "battle-a",

    turnNumber: 1,

    events,
  };
}

describe("BattlePresentationQueue critical workflow failures", () => {
  it("blocks the queue when Evolution decision presentation fails", async () => {
    const attempted = createDeferred();

    const failure = new Error("Evolution persistence conflict");

    const presentEvent = vi.fn(
      (event: BattlePresentationEvent): Promise<void> => {
        attempted.resolve();

        if (event.type === "evolution-required") {
          return Promise.reject(failure);
        }

        return Promise.resolve();
      },
    );

    const onTurnCompleted = vi.fn(() => Promise.resolve());

    const onIdle = vi.fn(() => Promise.resolve());

    const queue = new BattlePresentationQueue({
      presentEvent,
      onTurnCompleted,
      onIdle,
    });

    queue.enqueue(
      createTurn([createEvolutionRequiredEvent(), createLevelUpEvent()]),
    );

    await attempted.promise;

    /*
     * Allow the rejected Promise to travel
     * through presentTurn() -> drain().
     */
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(queue.isBlocked).toBe(true);

    expect(queue.isBusy).toBe(true);

    /*
     * The event after Evolution must never
     * overtake the failed decision.
     */
    expect(presentEvent).toHaveBeenCalledTimes(1);

    expect(onTurnCompleted).not.toHaveBeenCalled();

    expect(onIdle).not.toHaveBeenCalled();

    /*
     * Lifecycle reset must release it.
     */
    queue.clear();

    expect(queue.isBlocked).toBe(false);

    expect(queue.isBusy).toBe(false);
  });

  it("continues after a non-interactive visual presentation failure", async () => {
    const idle = createDeferred();

    const presentEvent = vi.fn(() =>
      Promise.reject(new Error("Visual animation failed")),
    );

    const onTurnCompleted = vi.fn(() => Promise.resolve());

    const onIdle = vi.fn(() => {
      idle.resolve();

      return Promise.resolve();
    });

    const queue = new BattlePresentationQueue({
      presentEvent,
      onTurnCompleted,
      onIdle,
    });

    queue.enqueue(createTurn([createLevelUpEvent()]));

    await idle.promise;

    expect(queue.isBlocked).toBe(false);

    expect(queue.isBusy).toBe(false);

    expect(onTurnCompleted).toHaveBeenCalledTimes(1);

    expect(onIdle).toHaveBeenCalledTimes(1);
  });
});

describe("BattlePresentationQueue event context", () => {
  it("exposes the immediately previous event for forced-replacement presentation", async () => {
    const idle = createDeferred();
    const contexts: BattlePresentationEventContext[] = [];

    const faintEvent: BattlePresentationEvent = {
      type: "pokemon-fainted",
      participantId: "npc-trainer",
      pokemonInstanceId: "rattata",
    };

    const switchEvent: BattlePresentationEvent = {
      type: "pokemon-switched",
      participantId: "npc-trainer",
      previousActivePokemonIndex: 0,
      currentActivePokemonIndex: 1,
      previousPokemonInstanceId: "rattata",
      currentPokemonInstanceId: "pidgey",
    };

    const queue = new BattlePresentationQueue({
      presentEvent: (_event, context) => {
        contexts.push(context);
      },
      onIdle: () => {
        idle.resolve();
      },
    });

    queue.enqueue(createTurn([faintEvent, switchEvent]));
    await idle.promise;

    expect(contexts).toHaveLength(2);
    expect(contexts[0]?.previousEvent).toBeUndefined();
    expect(contexts[1]?.previousEvent).toEqual(faintEvent);
  });
});
