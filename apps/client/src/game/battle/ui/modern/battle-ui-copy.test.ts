import { describe, expect, it } from "vitest";

import { getBattleIntroCopy } from "./battle-ui-copy";

describe("getBattleIntroCopy", () => {
  it("includes the opposing Trainer name", () => {
    expect(getBattleIntroCopy("trainer", "Gary")).toEqual({
      eyebrow: "TRAINER BATTLE",
      title: "VS GARY",
      subtitle: "Gary challenges you!",
    });
  });

  it("uses a safe Trainer fallback", () => {
    expect(getBattleIntroCopy("trainer").title).toBe("VS TRAINER");
  });

  it("formats a Wild encounter", () => {
    expect(getBattleIntroCopy("wild", "Pikachu")).toEqual({
      eyebrow: "WILD ENCOUNTER",
      title: "PIKACHU",
      subtitle: "A wild Pokémon appeared!",
    });
  });
});
