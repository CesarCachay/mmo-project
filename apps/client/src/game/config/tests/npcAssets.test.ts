import { describe, expect, it } from "vitest";

import {
  getNpcTextureKey,
  getNpcTextureKeyCandidates,
} from "../npcAssets";

describe("npcAssets", () => {
  it("keeps the requested direction first when it is configured", () => {
    expect(getNpcTextureKeyCandidates("professor-oak", "left")).toEqual([
      "npc-professor-oak-walk-left",
      "npc-professor-oak-walk-down",
      "npc-professor-oak-walk-up",
      "npc-professor-oak-walk-right",
    ]);
  });

  it("falls back to an available configured direction without changing the logical direction", () => {
    expect(getNpcTextureKeyCandidates("student-francisca", "left")).toEqual([
      "npc-student-francisca-walk-left",
      "npc-student-francisca-walk-down",
    ]);
  });

  it("only tries the requested texture for an unknown sprite id", () => {
    expect(getNpcTextureKeyCandidates("custom-npc", "right")).toEqual([
      getNpcTextureKey("custom-npc", "right"),
    ]);
  });
});
