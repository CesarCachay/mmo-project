import { getAllPokemonMoves } from "@cesar-mmo/shared";
import { describe, expect, it } from "vitest";

import {
  getBattleMoveVfxDefinition,
  getExplicitBattleMoveVfxCount,
  hasExplicitBattleMoveVfx,
} from "./move-vfx.registry";

describe("Battle Move VFX coverage", () => {
  it("provides a VFX definition for every imported move", () => {
    const moves = getAllPokemonMoves();
    const missing = moves.filter((move) => !getBattleMoveVfxDefinition(move.id));

    expect(moves).toHaveLength(485);
    expect(missing).toEqual([]);
  });

  it("keeps premium mappings explicit and uses generic fallback for every non-explicit move", () => {
    const moves = getAllPokemonMoves();
    const explicit = moves.filter((move) => hasExplicitBattleMoveVfx(move.id));
    const nonExplicit = moves.filter((move) => !hasExplicitBattleMoveVfx(move.id));
    const fallback = moves.filter(
      (move) => getBattleMoveVfxDefinition(move.id)?.archetype === "generic"
    );

    expect(getExplicitBattleMoveVfxCount()).toBe(explicit.length);
    expect(fallback).toHaveLength(nonExplicit.length);

    for (const move of nonExplicit) {
      expect(getBattleMoveVfxDefinition(move.id)?.archetype).toBe("generic");
    }

    expect(explicit.length + fallback.length).toBe(485);
  });
});
