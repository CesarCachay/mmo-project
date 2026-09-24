import { describe, expect, it } from "vitest";

import {
  getBattleStatusVfxBurstDefinition,
  getBattleStatusVfxDefinition,
  getBattleStatusVfxIds,
} from "./battle-status-vfx";

describe("battle-status-vfx", () => {
  it("exposes all persistent status ids", () => {
    expect(getBattleStatusVfxIds()).toEqual([
      "burn",
      "poison",
      "badly-poisoned",
      "paralysis",
      "sleep",
      "freeze",
      "confusion",
    ]);
  });

  it("provides a burst definition for inflict", () => {
    expect(getBattleStatusVfxBurstDefinition("inflict")).toMatchObject({
      kind: "inflict",
      className: "battle-status-vfx__burst--inflict",
      durationMs: 420,
    });
  });

  it("keeps all burst durations short enough for battle pacing", () => {
    for (const kind of ["inflict", "clear", "blocked", "residual", "self-hit"] as const) {
      expect(getBattleStatusVfxBurstDefinition(kind).durationMs).toBeLessThanOrEqual(440);
    }
  });

  it("defines a stable persistent effect for burn", () => {
    expect(getBattleStatusVfxDefinition("burn")).toMatchObject({
      id: "burn",
      className: "battle-status-vfx__effect--burn",
    });
  });
});
