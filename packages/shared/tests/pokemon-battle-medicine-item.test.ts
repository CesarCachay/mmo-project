import { describe, expect, it } from "vitest";

import {
  createBattleParticipant,
  createBattlePokemonState,
  createPokemonInstance,
  createPokemonInventory,
  planBattleTrainerMedicineItemUse,
  type BattleInstance,
} from "../src/index.js";

function createBattleWithStatus(
  major: "burn" | "poison" | "badly-poisoned" | "paralysis" | "sleep" | "freeze" | null,
  confusion = false,
): BattleInstance {
  const trainerPokemon = createBattlePokemonState(createPokemonInstance(25, 30));
  trainerPokemon.statusState = {
    major:
      major === "sleep"
        ? { type: "sleep", turnsRemaining: 2 }
        : major === "badly-poisoned"
          ? { type: "badly-poisoned", toxicCounter: 3 }
          : major === null
            ? null
            : { type: major },
    confusion: confusion ? { turnsRemaining: 3 } : null,
  };

  return {
    battleId: "medicine-status-test",
    type: "wild",
    status: "active",
    participants: [
      createBattleParticipant({
        id: "trainer",
        type: "trainer",
        side: "side-a",
        pokemon: [trainerPokemon],
      }),
      createBattleParticipant({
        id: "wild",
        type: "wild",
        side: "side-b",
        pokemon: [createBattlePokemonState(createPokemonInstance(1, 30))],
      }),
    ],
  };
}

function targetAction(itemId: "antidote" | "burn-heal" | "full-heal") {
  return {
    type: "use-item" as const,
    itemId,
    target: {
      type: "trainer-pokemon" as const,
      pokemonInstanceId: createPokemonInstance(25, 30).instanceId,
    },
  };
}

describe("battle Trainer medicine status planning", () => {
  it("plans Antidote for Poison", () => {
    const battle = createBattleWithStatus("poison");
    const targetId = battle.participants[0]!.pokemon[0]!.pokemon.instanceId;

    const plan = planBattleTrainerMedicineItemUse(
      battle,
      "trainer",
      {
        ...targetAction("antidote"),
        target: { type: "trainer-pokemon", pokemonInstanceId: targetId },
      },
      createPokemonInventory([{ itemId: "antidote", quantity: 1 }]),
    );

    expect(plan).toEqual({
      kind: "status-cure",
      participantId: "trainer",
      itemId: "antidote",
      targetPokemonInstanceId: targetId,
      curedMajorStatus: "poison",
      curedConfusion: false,
    });
  });

  it("lets Full Heal clear a major status and Confusion together", () => {
    const battle = createBattleWithStatus("burn", true);
    const targetId = battle.participants[0]!.pokemon[0]!.pokemon.instanceId;

    const plan = planBattleTrainerMedicineItemUse(
      battle,
      "trainer",
      {
        ...targetAction("full-heal"),
        target: { type: "trainer-pokemon", pokemonInstanceId: targetId },
      },
      createPokemonInventory([{ itemId: "full-heal", quantity: 1 }]),
    );

    expect(plan.kind).toBe("status-cure");
    if (plan.kind !== "status-cure") {
      throw new Error("Expected status-cure plan");
    }
    expect(plan.curedMajorStatus).toBe("burn");
    expect(plan.curedConfusion).toBe(true);
  });

  it("rejects a medicine item that does not match the target status", () => {
    const battle = createBattleWithStatus("paralysis");
    const targetId = battle.participants[0]!.pokemon[0]!.pokemon.instanceId;

    expect(() =>
      planBattleTrainerMedicineItemUse(
        battle,
        "trainer",
        {
          ...targetAction("burn-heal"),
          target: { type: "trainer-pokemon", pokemonInstanceId: targetId },
        },
        createPokemonInventory([{ itemId: "burn-heal", quantity: 1 }]),
      ),
    ).toThrow(/has no status curable/);
  });
});
