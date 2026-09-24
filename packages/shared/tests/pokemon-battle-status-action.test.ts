import { describe, expect, it } from "vitest";

import {
  createBattlePokemonState,
  createPokemonInstance,
  getPokemonMove,
  isBattlePresentationEvent,
  resolveBattleStatusAction,
  type BattleMoveExecutionContext,
} from "../src/index.js";

function createContext(
  moveId = 33,
  actorSpeciesId = 25,
  targetSpeciesId = 1,
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
    battleId: "status-action-test",
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

describe("Pokémon Battle status action resolution", () => {
  it("blocks sleep for the configured number of actions and clears on the last blocked action", () => {
    const context = createContext();
    context.actorPokemon.statusState!.major = {
      type: "sleep",
      turnsRemaining: 2,
    };

    expect(resolveBattleStatusAction(context, () => 0)).toEqual({
      canExecuteMove: false,
      effects: [{ type: "action-prevented", status: "sleep" }],
    });
    expect(context.actorPokemon.statusState?.major).toEqual({
      type: "sleep",
      turnsRemaining: 1,
    });

    expect(resolveBattleStatusAction(context, () => 0)).toEqual({
      canExecuteMove: false,
      effects: [
        { type: "action-prevented", status: "sleep" },
        { type: "status-cleared", status: "sleep" },
      ],
    });
    expect(context.actorPokemon.statusState?.major).toBeNull();

    expect(resolveBattleStatusAction(context, () => 0)).toEqual({
      canExecuteMove: true,
      effects: [],
    });
  });

  it("uses the Generation IV 20% natural thaw chance", () => {
    const frozen = createContext();
    frozen.actorPokemon.statusState!.major = { type: "freeze" };

    expect(resolveBattleStatusAction(frozen, () => 0.2)).toEqual({
      canExecuteMove: false,
      effects: [{ type: "action-prevented", status: "freeze" }],
    });
    expect(frozen.actorPokemon.statusState?.major).toEqual({ type: "freeze" });

    const thawed = createContext();
    thawed.actorPokemon.statusState!.major = { type: "freeze" };

    expect(resolveBattleStatusAction(thawed, () => 0.199)).toEqual({
      canExecuteMove: true,
      effects: [{ type: "status-cleared", status: "freeze" }],
    });
    expect(thawed.actorPokemon.statusState?.major).toBeNull();
  });

  it("lets Flame Wheel, Sacred Fire and Flare Blitz thaw the frozen user without a thaw RNG roll", () => {
    for (const moveId of [172, 221, 394]) {
      const context = createContext(moveId);
      context.actorPokemon.statusState!.major = { type: "freeze" };

      const random = () => {
        throw new Error("self-thaw move must not roll natural thaw RNG");
      };

      expect(resolveBattleStatusAction(context, random)).toEqual({
        canExecuteMove: true,
        effects: [{ type: "status-cleared", status: "freeze" }],
      });
    }
  });

  it("does not advance confusion while sleep prevents the action", () => {
    const context = createContext();
    context.actorPokemon.statusState!.major = {
      type: "sleep",
      turnsRemaining: 2,
    };
    context.actorPokemon.statusState!.confusion = { turnsRemaining: 4 };

    resolveBattleStatusAction(context, () => 0);

    expect(context.actorPokemon.statusState?.confusion).toEqual({
      turnsRemaining: 4,
    });
  });

  it("snaps out on the final confusion action and allows the selected move", () => {
    const context = createContext();
    context.actorPokemon.statusState!.confusion = { turnsRemaining: 1 };

    expect(resolveBattleStatusAction(context, () => 0)).toEqual({
      canExecuteMove: true,
      effects: [{ type: "status-cleared", status: "confusion" }],
    });
    expect(context.actorPokemon.statusState?.confusion).toBeNull();
  });

  it("applies typeless physical confusion self-damage and prevents the move", () => {
    const context = createContext();
    context.actorPokemon.statusState!.confusion = { turnsRemaining: 3 };
    const previousHp = context.actorPokemon.currentHp;

    const result = resolveBattleStatusAction(
      context,
      sequenceRandom(0.1, 0.5),
    );

    expect(result.canExecuteMove).toBe(false);
    expect(result.effects).toEqual([
      expect.objectContaining({
        type: "confusion-self-damage",
        previousHp,
        currentHp: expect.any(Number),
        appliedDamage: expect.any(Number),
      }),
    ]);
    expect(context.actorPokemon.currentHp).toBeLessThan(previousHp);
    expect(context.actorPokemon.statusState?.confusion).toEqual({
      turnsRemaining: 2,
    });
  });

  it("uses the Generation IV 25% full-paralysis chance", () => {
    const blocked = createContext();
    blocked.actorPokemon.statusState!.major = { type: "paralysis" };

    expect(resolveBattleStatusAction(blocked, () => 0.249)).toEqual({
      canExecuteMove: false,
      effects: [{ type: "action-prevented", status: "paralysis" }],
    });

    const allowed = createContext();
    allowed.actorPokemon.statusState!.major = { type: "paralysis" };

    expect(resolveBattleStatusAction(allowed, () => 0.25)).toEqual({
      canExecuteMove: true,
      effects: [],
    });
  });

  it("accepts the Step 4 presentation event shapes on the network boundary", () => {
    expect(
      isBattlePresentationEvent({
        type: "status-cleared",
        participantId: "actor",
        pokemonInstanceId: "pokemon-1",
        status: "confusion",
      }),
    ).toBe(true);

    expect(
      isBattlePresentationEvent({
        type: "status-action-prevented",
        participantId: "actor",
        pokemonInstanceId: "pokemon-1",
        status: "paralysis",
      }),
    ).toBe(true);

    expect(
      isBattlePresentationEvent({
        type: "confusion-self-damage",
        participantId: "actor",
        pokemonInstanceId: "pokemon-1",
        previousHp: 30,
        currentHp: 20,
        appliedDamage: 10,
      }),
    ).toBe(true);
  });
});
