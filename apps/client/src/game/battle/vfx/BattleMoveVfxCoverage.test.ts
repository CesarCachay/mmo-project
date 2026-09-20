import { getAllPokemonMoves } from "@cesar-mmo/shared";
import { describe, expect, it } from "vitest";

import {
  getBattleMoveVfxDefinition,
  getExplicitBattleMoveVfxCount,
  hasExplicitBattleMoveVfx,
} from "./move-vfx.registry";

describe("Battle Move VFX V1 coverage", () => {
  it("provides a VFX definition for every imported move", () => {
    const moves = getAllPokemonMoves();
    const missing = moves.filter((move) => !getBattleMoveVfxDefinition(move.id));

    expect(moves).toHaveLength(485);
    expect(missing).toEqual([]);
  });

  it("keeps premium mappings explicit and uses generic fallback for the rest", () => {
    const moves = getAllPokemonMoves();
    const explicit = moves.filter((move) => hasExplicitBattleMoveVfx(move.id));
    const fallback = moves.filter((move) => getBattleMoveVfxDefinition(move.id)?.archetype === "generic");

    expect(getExplicitBattleMoveVfxCount()).toBe(87);
    expect(explicit).toHaveLength(87);
    expect(fallback).toHaveLength(398);
    expect(explicit.length + fallback.length).toBe(485);
  });
});
