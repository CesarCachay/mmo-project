import { describe, expect, it } from "vitest";

import type {
  BattlePokemonState,
  PokemonEvolutionRequiredPayload,
  PokemonEvolutionResolvedPayload,
  PokemonInstance,
} from "@cesar-mmo/shared";

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

const pokemonInstanceId = "pokemon-a";

const requiredEvolution: PokemonEvolutionRequiredPayload = {
  pokemonInstanceId,

  sourceSpeciesId: 4,
  sourceFormId: 4,

  targetSpeciesId: 5,
  targetFormId: 5,

  triggerLevel: 16,
  revision: 0,
};

const authoritativePokemon: PokemonInstance = {
  instanceId: pokemonInstanceId,

  /*
   * Authoritative result:
   * species/form 5.
   */
  speciesId: 5,
  formId: 5,

  level: 16,
  experience: 2500,
  currentHp: 42,

  abilityId: 66,

  moves: [
    {
      moveId: 1,
      currentPp: 35,
    },
  ],
};

describe("PokemonBattleEvolutionHudSyncCoordinator", () => {
  it("synchronizes authoritative TrainerState before releasing cinematic mode", async () => {
    const order: string[] = [];

    const evolutionResolved = createDeferred<PokemonEvolutionResolvedPayload>();

    let synchronizedPokemon: BattlePokemonState | undefined;

    const coordinator = new PokemonBattleEvolutionHudSyncCoordinator({
      presentRequiredEvolution: async () => {
        order.push("presentation-start");

        const response = await evolutionResolved.promise;

        order.push("presentation-end");

        return response;
      },

      getTrainerState: () => ({
        party: {
          pokemon: [authoritativePokemon],
        },
      }),

      syncTrainerPokemonAfterEvolution: (evolvedPokemon) => {
        order.push("hud-sync");

        synchronizedPokemon = evolvedPokemon;
      },

      finishEvolutionCinematic: () => {
        order.push("cinematic-finish");
      },
    });

    const presentationPromise =
      coordinator.presentRequiredEvolution(requiredEvolution);

    /*
     * Presentation is still waiting
     * for the server response.
     */
    await Promise.resolve();

    expect(order).toEqual(["presentation-start"]);

    expect(order).not.toContain("hud-sync");

    expect(order).not.toContain("cinematic-finish");

    /*
     * Deliberately make the presentation
     * payload disagree with TrainerState.
     *
     * If HUD sync incorrectly trusts this
     * payload, the test will expose it.
     */
    evolutionResolved.resolve({
      pokemonInstanceId,

      resolvedRevision: 0,

      decision: {
        type: "accept",
      },

      evolution: {
        pokemonInstanceId,

        previousSpeciesId: 4,
        previousFormId: 4,

        /*
         * Intentionally WRONG.
         */
        currentSpeciesId: 999,
        currentFormId: 999,
      },
    });

    await presentationPromise;

    expect(order).toEqual([
      "presentation-start",
      "presentation-end",

      /*
       * Critical order:
       */
      "hud-sync",
      "cinematic-finish",
    ]);

    expect(synchronizedPokemon).toBeDefined();

    expect(synchronizedPokemon?.pokemon.speciesId).toBe(5);

    expect(synchronizedPokemon?.pokemon.formId).toBe(5);

    /*
     * Proves EVOLUTION_RESOLVED values
     * did not fabricate HUD state.
     */
    expect(synchronizedPokemon?.pokemon.speciesId).not.toBe(999);

    expect(synchronizedPokemon?.pokemon.formId).not.toBe(999);
  });

  it("does not synchronize Pokémon on CANCEL but still releases cinematic mode", async () => {
    const order: string[] = [];

    const coordinator = new PokemonBattleEvolutionHudSyncCoordinator({
      presentRequiredEvolution: async () => ({
        pokemonInstanceId,

        resolvedRevision: 0,

        decision: {
          type: "cancel",
        },

        evolution: null,
      }),

      getTrainerState: () => ({
        party: {
          pokemon: [authoritativePokemon],
        },
      }),

      syncTrainerPokemonAfterEvolution: () => {
        order.push("hud-sync");
      },

      finishEvolutionCinematic: () => {
        order.push("cinematic-finish");
      },
    });

    await coordinator.presentRequiredEvolution(requiredEvolution);

    expect(order).toEqual(["cinematic-finish"]);
  });

  it("always releases cinematic mode if Evolution presentation fails", async () => {
    const order: string[] = [];

    const coordinator = new PokemonBattleEvolutionHudSyncCoordinator({
      presentRequiredEvolution: () =>
        Promise.reject(new Error("network failure")),

      getTrainerState: () => ({
        party: {
          pokemon: [authoritativePokemon],
        },
      }),

      syncTrainerPokemonAfterEvolution: () => {
        order.push("hud-sync");
      },

      finishEvolutionCinematic: () => {
        order.push("cinematic-finish");
      },
    });

    await expect(
      coordinator.presentRequiredEvolution(requiredEvolution),
    ).rejects.toThrow("network failure");

    expect(order).toEqual(["cinematic-finish"]);
  });
});
