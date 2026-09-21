import { describe, expect, it } from "vitest";

import type { BattleInstance } from "@cesar-mmo/shared";

import {
  getBattleOpponentPartyIndicatorModel,
  getBattlePlayerPartyIndicatorModel,
} from "./battle-opponent-party-indicator";

function createBattle(
  type: "wild" | "trainer",
  opponentHp: readonly number[],
  playerHp: readonly number[] = [20],
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
        pokemon: playerHp.map((currentHp, index) => ({
          pokemon: { instanceId: `player-${index}` },
          currentHp,
        })),
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

  it("shows the local Trainer party with available and fainted slots", () => {
    expect(
      getBattlePlayerPartyIndicatorModel(
        createBattle("trainer", [18, 32, 40], [42, 0, 17]),
        "player",
      ),
    ).toEqual({
      displayName: "You",
      totalPokemon: 3,
      usablePokemon: 2,
      slots: ["available", "defeated", "available"],
    });
  });

  it("hides the local party indicator for Wild Battles", () => {
    expect(
      getBattlePlayerPartyIndicatorModel(
        createBattle("wild", [12], [20, 0, 18]),
        "player",
      ),
    ).toBeUndefined();
  });
});
