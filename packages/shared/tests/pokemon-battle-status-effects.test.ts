import { describe, expect, it } from "vitest";

import {
  applyBattleEndTurnStatusEffects,
  applyBattleStatusAttackModifier,
  applyBattleStatusSpeedModifier,
  calculatePokemonMaxHp,
  createBattleParticipant,
  createBattlePokemonState,
  createPokemonInstance,
  isBattlePresentationEvent,
  resetBattlePokemonBadPoisonCounter,
} from "../src/index.js";

function createBattle() {
  const leftPokemon = createBattlePokemonState(createPokemonInstance(1, 30));
  const rightPokemon = createBattlePokemonState(createPokemonInstance(4, 30));

  const left = createBattleParticipant({
    id: "left",
    type: "trainer",
    side: "side-a",
    pokemon: [leftPokemon],
    activePokemonIndex: 0,
  });

  const right = createBattleParticipant({
    id: "right",
    type: "trainer",
    side: "side-b",
    pokemon: [rightPokemon],
    activePokemonIndex: 0,
  });

  return {
    battleId: "status-effects-test",
    type: "trainer" as const,
    status: "active" as const,
    participants: [left, right],
  };
}

describe("Pokémon Battle status residual/stat effects", () => {
  it("halves physical Attack for Burn and quarters Speed for Paralysis", () => {
    const pokemon = createBattlePokemonState(createPokemonInstance(25, 30));

    pokemon.statusState!.major = { type: "burn" };
    expect(applyBattleStatusAttackModifier(pokemon, 101)).toBe(50);
    expect(applyBattleStatusSpeedModifier(pokemon, 100)).toBe(100);

    pokemon.statusState!.major = { type: "paralysis" };
    expect(applyBattleStatusAttackModifier(pokemon, 101)).toBe(101);
    expect(applyBattleStatusSpeedModifier(pokemon, 101)).toBe(25);
  });

  it("applies 1/8 max HP residual damage for Burn and Poison", () => {
    const battle = createBattle();
    const left = battle.participants[0]!.pokemon[0]!;
    const right = battle.participants[1]!.pokemon[0]!;

    left.statusState!.major = { type: "burn" };
    right.statusState!.major = { type: "poison" };

    const leftPreviousHp = left.currentHp;
    const rightPreviousHp = right.currentHp;

    const effects = applyBattleEndTurnStatusEffects(battle);

    expect(effects).toHaveLength(2);
    expect(leftPreviousHp - left.currentHp).toBe(
      Math.max(1, Math.floor(calculatePokemonMaxHp(left.pokemon) / 8)),
    );
    expect(rightPreviousHp - right.currentHp).toBe(
      Math.max(1, Math.floor(calculatePokemonMaxHp(right.pokemon) / 8)),
    );
  });

  it("escalates Bad Poison from n/16 max HP and caps the toxic counter", () => {
    const battle = createBattle();
    const pokemon = battle.participants[0]!.pokemon[0]!;
    battle.participants[1]!.pokemon[0]!.statusState!.major = null;

    pokemon.statusState!.major = {
      type: "badly-poisoned",
      toxicCounter: 1,
    };

    const maxHp = calculatePokemonMaxHp(pokemon.pokemon);
    const firstHp = pokemon.currentHp;
    const first = applyBattleEndTurnStatusEffects(battle)[0]!;

    expect(first.status).toBe("badly-poisoned");
    expect(first.toxicCounter).toBe(1);
    expect(first.appliedDamage).toBe(Math.max(1, Math.floor(maxHp / 16)));
    expect(pokemon.statusState!.major).toEqual({
      type: "badly-poisoned",
      toxicCounter: 2,
    });

    const second = applyBattleEndTurnStatusEffects(battle)[0]!;
    expect(second.toxicCounter).toBe(2);
    expect(second.appliedDamage).toBe(Math.max(1, Math.floor((maxHp * 2) / 16)));
    expect(pokemon.currentHp).toBe(firstHp - first.appliedDamage - second.appliedDamage);
  });

  it("resets the toxic counter to 1 when a badly-poisoned Pokémon leaves the field", () => {
    const pokemon = createBattlePokemonState(createPokemonInstance(7, 30));
    pokemon.statusState!.major = {
      type: "badly-poisoned",
      toxicCounter: 6,
    };

    expect(resetBattlePokemonBadPoisonCounter(pokemon)).toBe(true);
    expect(pokemon.statusState!.major).toEqual({
      type: "badly-poisoned",
      toxicCounter: 1,
    });
  });

  it("keeps the current Battle V1 no-simultaneous-defeat invariant", () => {
    const battle = createBattle();
    const left = battle.participants[0]!.pokemon[0]!;
    const right = battle.participants[1]!.pokemon[0]!;

    left.statusState!.major = { type: "poison" };
    right.statusState!.major = { type: "burn" };
    left.currentHp = 1;
    right.currentHp = 1;

    const effects = applyBattleEndTurnStatusEffects(battle);

    expect(effects).toHaveLength(1);
    expect(left.currentHp).toBe(0);
    expect(right.currentHp).toBe(1);
  });

  it("accepts the Step 5 residual damage event on the presentation boundary", () => {
    expect(
      isBattlePresentationEvent({
        type: "status-residual-damage",
        participantId: "left",
        pokemonInstanceId: "pokemon-1",
        status: "badly-poisoned",
        previousHp: 40,
        currentHp: 30,
        appliedDamage: 10,
        toxicCounter: 2,
      }),
    ).toBe(true);
  });
});
