import { describe, expect, it } from "vitest";

import { isPokemonMoveLearningResolvedPayload } from "./pokemon-progression-network.js";

const pokemonInstanceId = "pokemon-instance-a";

const basePayload = {
  pokemonInstanceId,

  resolvedCandidateMoveId: 33,
  resolvedRevision: 0,

  decision: {
    type: "cancel",
  } as const,

  currentMoves: [
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
  ],
};

describe("isPokemonMoveLearningResolvedPayload", () => {
  it("accepts a completed Move Learning without continuation", () => {
    expect(
      isPokemonMoveLearningResolvedPayload({
        ...basePayload,

        nextPending: null,
        pendingEvolution: null,
      }),
    ).toBe(true);
  });

  it("accepts Evolution after final Move Learning", () => {
    expect(
      isPokemonMoveLearningResolvedPayload({
        ...basePayload,

        nextPending: null,

        pendingEvolution: {
          pokemonInstanceId,

          sourceSpeciesId: 4,
          sourceFormId: 4,

          targetSpeciesId: 5,
          targetFormId: 5,

          triggerLevel: 16,
          revision: 0,
        },
      }),
    ).toBe(true);
  });

  it("rejects Move Learning and Evolution pending simultaneously", () => {
    expect(
      isPokemonMoveLearningResolvedPayload({
        ...basePayload,

        nextPending: {
          pokemonInstanceId,

          candidateMoveId: 44,
          candidateLearnedAtLevel: 17,

          revision: 1,

          currentMoves: basePayload.currentMoves,
        },

        pendingEvolution: {
          pokemonInstanceId,

          sourceSpeciesId: 4,
          sourceFormId: 4,

          targetSpeciesId: 5,
          targetFormId: 5,

          triggerLevel: 16,
          revision: 0,
        },
      }),
    ).toBe(false);
  });

  it("rejects Evolution belonging to another Pokémon", () => {
    expect(
      isPokemonMoveLearningResolvedPayload({
        ...basePayload,

        nextPending: null,

        pendingEvolution: {
          pokemonInstanceId: "another-pokemon",

          sourceSpeciesId: 4,
          sourceFormId: 4,

          targetSpeciesId: 5,
          targetFormId: 5,

          triggerLevel: 16,
          revision: 0,
        },
      }),
    ).toBe(false);
  });
});
