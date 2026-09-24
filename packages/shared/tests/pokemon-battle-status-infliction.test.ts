import { describe, expect, it } from "vitest";

import {
  applyBattleMoveStatusEffects,
  createBattlePokemonState,
  createPokemonInstance,
  getPokemonMove,
  type BattleMoveExecutionContext,
} from "../src/index.js";

function createContext(
  moveId: number,
  targetSpeciesId = 1,
  actorSpeciesId = 25,
): BattleMoveExecutionContext {
  const move = getPokemonMove(moveId);

  if (!move) {
    throw new Error(`Missing move ${moveId} in test registry`);
  }

  const actorPokemon = createBattlePokemonState(
    createPokemonInstance(actorSpeciesId, 30),
  );
  const targetPokemon = createBattlePokemonState(
    createPokemonInstance(targetSpeciesId, 30),
  );

  return {
    battleId: "status-test",
    actorParticipantId: "actor",
    targetParticipantId: "target",
    actorPokemon,
    targetPokemon,
    selectedMove: {
      moveId,
      currentPp: move.pp ?? 1,
    },
    move,
  };
}

function sequenceRandom(...values: number[]): () => number {
  let index = 0;

  return () => {
    const value = values[index];
    index += 1;

    if (value === undefined) {
      throw new Error(`Unexpected RNG read at index ${index - 1}`);
    }

    return value;
  };
}

describe("Pokémon Battle status infliction", () => {
  it("applies a direct major status to an eligible target", () => {
    const context = createContext(261); // Will-O-Wisp

    const results = applyBattleMoveStatusEffects({ context, random: () => 0 });

    expect(results).toEqual([
      {
        type: "applied",
        status: "burn",
        targetParticipantId: "target",
        targetPokemonInstanceId: context.targetPokemon.pokemon.instanceId,
      },
    ]);
    expect(context.targetPokemon.statusState?.major).toEqual({ type: "burn" });
  });

  it("enforces major-status exclusivity while allowing confusion to coexist", () => {
    const burnContext = createContext(261);
    burnContext.targetPokemon.statusState!.major = { type: "poison" };

    expect(applyBattleMoveStatusEffects({ context: burnContext, random: () => 0 })).toEqual([
      expect.objectContaining({
        type: "blocked",
        status: "burn",
        reason: "major-status-present",
      }),
    ]);

    const confusionContext = createContext(109); // Confuse Ray
    confusionContext.targetPokemon.statusState!.major = { type: "burn" };

    applyBattleMoveStatusEffects({ context: confusionContext, random: () => 0 });

    expect(confusionContext.targetPokemon.statusState).toEqual({
      major: { type: "burn" },
      confusion: { turnsRemaining: 2 },
    });
  });

  it("creates deterministic sleep/confusion durations from injected RNG", () => {
    const sleepContext = createContext(47); // Sing
    applyBattleMoveStatusEffects({ context: sleepContext, random: () => 0.999 });
    expect(sleepContext.targetPokemon.statusState?.major).toEqual({
      type: "sleep",
      turnsRemaining: 4,
    });

    const confusionContext = createContext(109); // Confuse Ray
    applyBattleMoveStatusEffects({ context: confusionContext, random: () => 0.999 });
    expect(confusionContext.targetPokemon.statusState?.confusion).toEqual({
      turnsRemaining: 5,
    });
  });

  it("enforces Gen I-IV type immunities for burn, poison and freeze", () => {
    const fireTarget = createContext(261, 4); // Charmander
    expect(applyBattleMoveStatusEffects({ context: fireTarget, random: () => 0 })).toEqual([
      expect.objectContaining({ reason: "type-immunity" }),
    ]);

    const poisonTarget = createContext(92, 1); // Bulbasaur: Grass/Poison
    expect(applyBattleMoveStatusEffects({ context: poisonTarget, random: () => 0 })).toEqual([
      expect.objectContaining({ reason: "type-immunity" }),
    ]);

    const steelTarget = createContext(92, 208); // Steelix
    expect(applyBattleMoveStatusEffects({ context: steelTarget, random: () => 0 })).toEqual([
      expect.objectContaining({ reason: "type-immunity" }),
    ]);

    const iceTarget = createContext(58, 124); // Jynx
    expect(
      applyBattleMoveStatusEffects({ context: iceTarget, random: () => 0 }),
    ).toEqual([expect.objectContaining({ reason: "type-immunity" })]);
  });

  it("blocks Thunder Wave on Ground but still allows non-Electric paralysis sources", () => {
    const thunderWave = createContext(86, 27); // Sandshrew
    expect(applyBattleMoveStatusEffects({ context: thunderWave, random: () => 0 })).toEqual([
      expect.objectContaining({ reason: "move-type-immunity" }),
    ]);

    const bodySlam = createContext(34, 27);
    expect(applyBattleMoveStatusEffects({ context: bodySlam, random: () => 0 })).toEqual([
      expect.objectContaining({ type: "applied", status: "paralysis" }),
    ]);
  });

  it("does not deliver secondary effects through a damaging type immunity", () => {
    const context = createContext(9, 27); // Thunder Punch -> Ground

    expect(applyBattleMoveStatusEffects({ context, random: () => 0 })).toEqual([
      expect.objectContaining({ reason: "move-type-immunity" }),
    ]);
    expect(context.targetPokemon.statusState?.major).toBeNull();
  });

  it("models Tri Attack as one proc followed by one random status choice", () => {
    const context = createContext(161);

    const results = applyBattleMoveStatusEffects({
      context,
      random: sequenceRandom(0.1, 0.4),
    });

    expect(results).toEqual([
      expect.objectContaining({ type: "applied", status: "freeze" }),
    ]);
    expect(context.targetPokemon.statusState?.major).toEqual({ type: "freeze" });
  });

  it("rolls per hit for Twineedle and stops RNG after the first successful poison", () => {
    const context = createContext(41, 25); // Pikachu is poison-eligible
    const random = sequenceRandom(0.9, 0.1);

    const results = applyBattleMoveStatusEffects({
      context,
      successfulHitCount: 2,
      random,
    });

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual(expect.objectContaining({ reason: "chance-failed" }));
    expect(results[1]).toEqual(
      expect.objectContaining({ type: "applied", status: "poison" }),
    );
    expect(context.targetPokemon.statusState?.major).toEqual({ type: "poison" });
  });

  it("never inflicts a new status on a fainted target", () => {
    const context = createContext(261);
    context.targetPokemon.currentHp = 0;

    expect(applyBattleMoveStatusEffects({ context, random: () => 0 })).toEqual([
      expect.objectContaining({ reason: "target-fainted" }),
    ]);
  });
});
