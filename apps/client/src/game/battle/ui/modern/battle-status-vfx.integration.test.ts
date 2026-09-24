import { describe, expect, it } from "vitest";

import {
  getBattleStatusVfxBurstDefinition,
  getBattleStatusVfxDefinition,
  getBattleStatusVfxIds,
  type BattleStatusVfxBurstKind,
} from "./battle-status-vfx";

const STATUS_IDS = [
  "burn",
  "poison",
  "badly-poisoned",
  "paralysis",
  "sleep",
  "freeze",
  "confusion",
] as const;

const BURST_KINDS: readonly BattleStatusVfxBurstKind[] = [
  "inflict",
  "clear",
  "blocked",
  "residual",
  "self-hit",
];

describe("Status Conditions VFX integration contract", () => {
  it("keeps the complete status VFX coverage", () => {
    expect(getBattleStatusVfxIds()).toEqual(STATUS_IDS);

    for (const status of STATUS_IDS) {
      const definition = getBattleStatusVfxDefinition(status);
      expect(definition.id).toBe(status);
      expect(definition.particleCount).toBeGreaterThan(0);
    }
  });

  it("keeps every transient burst within the handheld timing budget", () => {
    for (const kind of BURST_KINDS) {
      const definition = getBattleStatusVfxBurstDefinition(kind);
      expect(definition.kind).toBe(kind);
      expect(definition.durationMs).toBeGreaterThan(0);
      expect(definition.durationMs).toBeLessThanOrEqual(450);
      expect(definition.particleCount).toBeGreaterThan(0);
    }
  });
});
