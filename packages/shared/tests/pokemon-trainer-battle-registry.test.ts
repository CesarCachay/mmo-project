import { describe, expect, it } from "vitest";

import { getDialogue } from "../src/dialogue.js";
import {
  POKEMON_TRAINER_BATTLE_REGISTRY,
  findPokemonTrainerBattleDefinition,
  getAllPokemonTrainerBattleDefinitions,
  getPokemonTrainerBattleDefinition,
  isPokemonTrainerBattleId,
} from "../src/pokemon/trainers/pokemon-trainer-battle.registry.js";
import { validatePokemonTrainerBattleDefinition } from "../src/pokemon/trainers/pokemon-trainer-battle.validation.js";

describe("POKEMON_TRAINER_BATTLE_REGISTRY", () => {
  it("contains valid trainer battle definitions", () => {
    const definitions = getAllPokemonTrainerBattleDefinitions();

    expect(definitions.length).toBeGreaterThan(0);

    const issues = definitions.flatMap((definition) =>
      validatePokemonTrainerBattleDefinition(definition),
    );

    expect(issues).toEqual([]);

    for (const definition of definitions) {
      expect(getDialogue(definition.preBattleDialogueId)).toBeDefined();
      expect(getDialogue(definition.postBattleDialogueId)).toBeDefined();
      expect(definition.rewardItems.length).toBeGreaterThan(0);
      expect(definition.rewardMoney).toBeGreaterThan(0);
    }
  });

  it("configures first-victory money rewards", () => {
    expect(getPokemonTrainerBattleDefinition("student-gary").rewardMoney).toBe(350);
    expect(getPokemonTrainerBattleDefinition("student-francisca").rewardMoney).toBe(500);
  });

  it("configures Route 02 trainers with three Pokémon from Lv12 to Lv18 and money rewards", () => {
    const route02TrainerIds = [
      "youngster-diego",
      "picnicker-valeria",
      "hiker-marcos",
      "ace-trainer-lucia",
    ] as const;

    for (const trainerBattleId of route02TrainerIds) {
      const definition = getPokemonTrainerBattleDefinition(trainerBattleId);

      expect(definition.party).toHaveLength(3);
      expect(definition.rewardMoney).toBeGreaterThan(0);

      for (const pokemon of definition.party) {
        expect(pokemon.level).toBeGreaterThanOrEqual(12);
        expect(pokemon.level).toBeLessThanOrEqual(18);
      }
    }
  });

  it("keeps registry keys aligned with definition ids", () => {
    for (const [trainerBattleId, definition] of Object.entries(
      POKEMON_TRAINER_BATTLE_REGISTRY,
    )) {
      expect(definition.id).toBe(trainerBattleId);
    }
  });

  it("resolves known trainer battle ids", () => {
    expect(isPokemonTrainerBattleId("student-gary")).toBe(true);
    expect(getPokemonTrainerBattleDefinition("student-gary").displayName).toBe(
      "Gary",
    );
    expect(findPokemonTrainerBattleDefinition("student-gary")?.party).toHaveLength(
      2,
    );
  });

  it("rejects unknown trainer battle ids", () => {
    expect(isPokemonTrainerBattleId("missing-trainer")).toBe(false);
    expect(findPokemonTrainerBattleDefinition("missing-trainer")).toBeUndefined();
  });
});
