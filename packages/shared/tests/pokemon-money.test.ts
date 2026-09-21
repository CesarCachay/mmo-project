import { describe, expect, it } from "vitest";

import {
  POKEMON_MAX_MONEY,
  POKEMON_STARTING_MONEY,
  addPokemonMoney,
  createPokemonMoney,
  isPokemonMoney,
  spendPokemonMoney,
} from "../src/index.js";

describe("pokemon money", () => {
  it("uses the configured starting balance", () => {
    expect(createPokemonMoney()).toBe(POKEMON_STARTING_MONEY);
  });

  it("accepts persisted balances inside the supported range", () => {
    expect(isPokemonMoney(0)).toBe(true);
    expect(isPokemonMoney(POKEMON_MAX_MONEY)).toBe(true);
    expect(isPokemonMoney(-1)).toBe(false);
    expect(isPokemonMoney(POKEMON_MAX_MONEY + 1)).toBe(false);
    expect(isPokemonMoney(12.5)).toBe(false);
  });

  it("caps earned money at the wallet maximum", () => {
    expect(addPokemonMoney(999_990, 100)).toBe(POKEMON_MAX_MONEY);
  });

  it("spends money without allowing a negative wallet", () => {
    expect(spendPokemonMoney(3_000, 700)).toBe(2_300);
    expect(() => spendPokemonMoney(100, 101)).toThrow(/Not enough money/);
  });
});
