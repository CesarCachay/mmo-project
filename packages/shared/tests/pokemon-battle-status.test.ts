import { describe, expect, it } from "vitest";

import {
  createBattlePokemonState,
  createEmptyBattlePokemonStatusState,
  createPokemonInstance,
  ensureBattlePokemonStatusState,
  hasBattlePokemonMajorStatus,
  isBattleMajorStatusCondition,
  isBattlePokemonStatusState,
} from "../src/index.js";

describe("Pokémon Battle status state", () => {
  it("creates an empty status state for every new BattlePokemonState", () => {
    const battlePokemon = createBattlePokemonState(createPokemonInstance(25, 10));

    expect(battlePokemon.statusState).toEqual({
      major: null,
      confusion: null,
    });
    expect(hasBattlePokemonMajorStatus(battlePokemon)).toBe(false);
  });

  it("normalizes a legacy BattlePokemonState that has no statusState", () => {
    const battlePokemon = createBattlePokemonState(createPokemonInstance(1, 10));
    delete battlePokemon.statusState;

    expect(ensureBattlePokemonStatusState(battlePokemon)).toEqual(
      createEmptyBattlePokemonStatusState(),
    );
    expect(battlePokemon.statusState).toEqual({
      major: null,
      confusion: null,
    });
  });

  it.each([
    "burn",
    "poison",
    "badly-poisoned",
    "paralysis",
    "sleep",
    "freeze",
  ] as const)("recognizes %s as a supported major condition", (condition) => {
    expect(isBattleMajorStatusCondition(condition)).toBe(true);
  });

  it("accepts major status and confusion together", () => {
    expect(
      isBattlePokemonStatusState({
        major: {
          type: "sleep",
          turnsRemaining: 2,
        },
        confusion: {
          turnsRemaining: 3,
        },
      }),
    ).toBe(true);
  });

  it("accepts badly-poisoned only with a positive toxic counter", () => {
    expect(
      isBattlePokemonStatusState({
        major: {
          type: "badly-poisoned",
          toxicCounter: 1,
        },
        confusion: null,
      }),
    ).toBe(true);

    expect(
      isBattlePokemonStatusState({
        major: {
          type: "badly-poisoned",
          toxicCounter: 0,
        },
        confusion: null,
      }),
    ).toBe(false);
  });

  it("rejects invalid sleep/confusion counters", () => {
    expect(
      isBattlePokemonStatusState({
        major: {
          type: "sleep",
          turnsRemaining: 0,
        },
        confusion: null,
      }),
    ).toBe(false);

    expect(
      isBattlePokemonStatusState({
        major: null,
        confusion: {
          turnsRemaining: -1,
        },
      }),
    ).toBe(false);
  });
});
