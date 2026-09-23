import { describe, expect, it } from "vitest";

import { resolveBattleMusicProfile } from "./battle-music-profile";

describe("resolveBattleMusicProfile", () => {
  it("routes Wild Battles to the wild profile", () => {
    expect(resolveBattleMusicProfile("wild", { kind: "wild" })).toBe("wild");
  });

  it("routes standard Trainer Battles to the trainer profile", () => {
    expect(
      resolveBattleMusicProfile("trainer", {
        kind: "trainer",
        trainerBattleId: "student-gary",
        trainerClass: "Student",
      }),
    ).toBe("trainer");
  });

  it("routes Gym Leaders to the dedicated gym-leader profile", () => {
    expect(
      resolveBattleMusicProfile("trainer", {
        kind: "gym-leader",
        trainerBattleId: "gym-leader-brock",
        trainerClass: "Gym Leader",
        gymId: "gym-01",
        badgeId: "boulder-badge",
        leaderPresentationId: "brock",
      }),
    ).toBe("gym-leader");
  });
});
