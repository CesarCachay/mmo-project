import { describe, expect, it } from "vitest";

import {
  getAllBattleStatusMoveDefinitions,
  getBattleDeferredStatusMoveEffects,
  getBattleExecutableStatusMoveEffects,
  getBattleStatusMoveDefinition,
  getBattleStatusMoveDefinitionCount,
  getPokemonMove,
  hasBattleStatusMoveDefinition,
} from "../src/index.js";

describe("Pokémon Battle status move registry", () => {
  it("registers direct major-status moves without duplicating move ids", () => {
    expect(getBattleExecutableStatusMoveEffects(261)).toEqual([
      {
        kind: "direct",
        status: "burn",
        target: "opponent",
        chancePercent: 100,
        rollScope: "once-per-move",
      },
    ]);

    expect(getBattleExecutableStatusMoveEffects(92)).toEqual([
      {
        kind: "direct",
        status: "badly-poisoned",
        target: "opponent",
        chancePercent: 100,
        rollScope: "once-per-move",
      },
    ]);
  });

  it("models Twineedle poison chance per hit", () => {
    expect(getBattleExecutableStatusMoveEffects(41)).toEqual([
      {
        kind: "direct",
        status: "poison",
        target: "opponent",
        chancePercent: 20,
        rollScope: "per-hit",
      },
    ]);
  });

  it("models Tri Attack as one 20% proc that chooses exactly one major status", () => {
    expect(getBattleExecutableStatusMoveEffects(161)).toEqual([
      {
        kind: "random-one-of",
        statuses: ["burn", "freeze", "paralysis"],
        target: "opponent",
        chancePercent: 20,
        rollScope: "once-per-move",
      },
    ]);
  });

  it("keeps composite/special status moves deferred from generic execution", () => {
    expect(getBattleExecutableStatusMoveEffects(281)).toEqual([]);
    expect(getBattleDeferredStatusMoveEffects(281)[0]?.mechanic).toBe(
      "delayed-sleep",
    );

    expect(getBattleExecutableStatusMoveEffects(156)).toEqual([]);
    expect(getBattleDeferredStatusMoveEffects(156)[0]?.target).toBe("self");
  });

  it("contains only moves that exist in the current Pokémon move registry", () => {
    const definitions = getAllBattleStatusMoveDefinitions();
    const uniqueMoveIds = new Set(definitions.map((definition) => definition.moveId));

    expect(uniqueMoveIds.size).toBe(definitions.length);
    expect(getBattleStatusMoveDefinitionCount()).toBe(definitions.length);

    for (const definition of definitions) {
      expect(getPokemonMove(definition.moveId), `moveId=${definition.moveId}`).toBeDefined();
      expect(hasBattleStatusMoveDefinition(definition.moveId)).toBe(true);
      expect(getBattleStatusMoveDefinition(definition.moveId)).toBe(definition);
    }
  });

  it("keeps every executable chance inside the valid percentage range", () => {
    for (const definition of getAllBattleStatusMoveDefinitions()) {
      for (const effect of definition.effects) {
        if (effect.kind === "deferred") {
          continue;
        }

        expect(effect.chancePercent).toBeGreaterThan(0);
        expect(effect.chancePercent).toBeLessThanOrEqual(100);
      }
    }
  });
});
