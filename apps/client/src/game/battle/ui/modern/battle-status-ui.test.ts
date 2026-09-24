import { describe, expect, it } from "vitest";

import type { BattleMajorStatusCondition } from "@cesar-mmo/shared";

import { getBattleMajorStatusUiDefinition } from "./battle-status-ui";

describe("getBattleMajorStatusUiDefinition", () => {
  it.each([
    ["burn", "BRN"],
    ["poison", "PSN"],
    ["badly-poisoned", "TOX"],
    ["paralysis", "PAR"],
    ["sleep", "SLP"],
    ["freeze", "FRZ"],
  ] as const)(
    "maps %s to %s",
    (status: BattleMajorStatusCondition, label: string) => {
      expect(getBattleMajorStatusUiDefinition(status).label).toBe(label);
    },
  );
});
