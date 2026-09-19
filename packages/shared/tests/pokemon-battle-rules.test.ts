import { describe, expect, it } from "vitest";

import {
  assertPokemonBattleCommandActionAllowed,
  createBattleCommand,
  createBattleParticipant,
  createBattlePokemonState,
  createPokemonInstance,
  evaluatePokemonBattleItemRule,
  evaluatePokemonBattleRunRule,
} from "../src/index.js";

function createWildBattle() {
  const trainer = createBattleParticipant({
    id: "player",
    type: "trainer",
    side: "side-a",
    pokemon: [createBattlePokemonState(createPokemonInstance(1, 10))],
  });

  const wild = createBattleParticipant({
    id: "wild",
    type: "wild",
    side: "side-b",
    pokemon: [createBattlePokemonState(createPokemonInstance(19, 7))],
  });

  return {
    battleId: "wild-rules",
    type: "wild" as const,
    status: "active" as const,
    participants: [trainer, wild],
  };
}

function createTrainerBattle() {
  const player = createBattleParticipant({
    id: "player",
    type: "trainer",
    side: "side-a",
    pokemon: [createBattlePokemonState(createPokemonInstance(1, 10))],
  });

  const npc = createBattleParticipant({
    id: "npc",
    type: "trainer",
    side: "side-b",
    displayName: "Gary",
    pokemon: [createBattlePokemonState(createPokemonInstance(19, 7))],
  });

  return {
    battleId: "trainer-rules",
    type: "trainer" as const,
    status: "active" as const,
    participants: [player, npc],
  };
}

describe("Pokémon Battle rules", () => {
  it("allows Run in Wild Battles and rejects it in Trainer Battles", () => {
    expect(evaluatePokemonBattleRunRule(createWildBattle())).toEqual({
      allowed: true,
    });

    expect(evaluatePokemonBattleRunRule(createTrainerBattle())).toEqual({
      allowed: false,
      reason: "run-not-allowed-in-trainer-battle",
    });
  });

  it("allows Poké Balls only in Wild Battles", () => {
    expect(evaluatePokemonBattleItemRule(createWildBattle(), "poke-ball")).toEqual({
      allowed: true,
    });

    expect(evaluatePokemonBattleItemRule(createTrainerBattle(), "poke-ball")).toEqual({
      allowed: false,
      reason: "capture-not-allowed-in-trainer-battle",
    });
  });

  it("allows supported medicine in Trainer Battles", () => {
    expect(evaluatePokemonBattleItemRule(createTrainerBattle(), "potion")).toEqual({
      allowed: true,
    });

    expect(evaluatePokemonBattleItemRule(createTrainerBattle(), "revive")).toEqual({
      allowed: true,
    });
  });

  it("rejects items that are not battle-usable", () => {
    expect(evaluatePokemonBattleItemRule(createTrainerBattle(), "rare-candy")).toEqual({
      allowed: false,
      reason: "item-not-battle-usable",
    });
  });

  it("enforces Trainer Battle Run rules inside createBattleCommand", () => {
    const battle = createTrainerBattle();

    expect(() =>
      createBattleCommand(battle, {
        participantId: "player",
        action: { type: "run" },
      }),
    ).toThrow(/run-not-allowed-in-trainer-battle/);
  });

  it("enforces Trainer Battle capture rules before command creation", () => {
    const battle = createTrainerBattle();

    expect(() =>
      assertPokemonBattleCommandActionAllowed(battle, {
        type: "use-item",
        itemId: "poke-ball",
        target: { type: "wild-active" },
      }),
    ).toThrow(/capture-not-allowed-in-trainer-battle/);
  });

  it("still allows a valid healing-item command in Trainer Battles", () => {
    const battle = createTrainerBattle();
    const playerPokemon = battle.participants[0]!.pokemon[0]!;

    expect(
      createBattleCommand(battle, {
        participantId: "player",
        action: {
          type: "use-item",
          itemId: "potion",
          target: {
            type: "trainer-pokemon",
            pokemonInstanceId: playerPokemon.pokemon.instanceId,
          },
        },
      }).action.type,
    ).toBe("use-item");
  });
});
