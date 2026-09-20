import { describe, expect, it } from "vitest";

import type { BattleInstance } from "@cesar-mmo/shared";

import { getBattleOpponentPartyIndicatorModel } from "./battle-opponent-party-indicator";

function createBattle(
  type: "wild" | "trainer",
  opponentHp: readonly number[],
): BattleInstance {
  return {
    battleId: "battle-a",
    type,
    status: "active",
    participants: [
      {
        id: "player",
        type: "trainer",
        side: "side-a",
        pokemon: [
          {
            pokemon: { instanceId: "player-mon" },
            currentHp: 20,
          },
        ],
        activePokemonIndex: 0,
      },
      {
        id: "opponent",
        type: type === "trainer" ? "trainer" : "wild",
        side: "side-b",
        displayName: type === "trainer" ? "Gary" : undefined,
        pokemon: opponentHp.map((currentHp, index) => ({
          pokemon: { instanceId: `opponent-${index}` },
          currentHp,
        })),
        activePokemonIndex: 0,
      },
    ],
  } as unknown as BattleInstance;
}

describe("getBattleOpponentPartyIndicatorModel", () => {
  it("shows every opposing Trainer Pokémon and marks fainted slots", () => {
    expect(
      getBattleOpponentPartyIndicatorModel(
        createBattle("trainer", [0, 18, 32]),
        "player",
      ),
    ).toEqual({
      displayName: "Gary",
      totalPokemon: 3,
      usablePokemon: 2,
      slots: ["defeated", "available", "available"],
    });
  });

  it("turns the whole Trainer party black when all Pokémon are defeated", () => {
    expect(
      getBattleOpponentPartyIndicatorModel(
        createBattle("trainer", [0, 0]),
        "player",
      )?.slots,
    ).toEqual(["defeated", "defeated"]);
  });

  it("stays hidden for Wild Battles", () => {
    expect(
      getBattleOpponentPartyIndicatorModel(
        createBattle("wild", [12]),
        "player",
      ),
    ).toBeUndefined();
  });
});
