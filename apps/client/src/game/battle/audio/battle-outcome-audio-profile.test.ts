import { describe, expect, it } from "vitest";

import { resolveBattleOutcomeAudioProfile } from "./battle-outcome-audio-profile";

describe("resolveBattleOutcomeAudioProfile", () => {
  it("keeps Wild victory on the existing standard victory cue", () => {
    expect(resolveBattleOutcomeAudioProfile("wild-defeated", { kind: "wild" })).toBe(
      "standard-victory",
    );
  });

  it("keeps standard Trainer victory on the existing victory cue", () => {
    expect(
      resolveBattleOutcomeAudioProfile("trainer-battle-victory", {
        kind: "trainer",
        trainerBattleId: "student-gary",
        trainerClass: "Student",
      }),
    ).toBe("standard-victory");
  });

  it("routes Gym Leader victory to the dedicated Gym victory cue", () => {
    expect(
      resolveBattleOutcomeAudioProfile("trainer-battle-victory", {
        kind: "gym-leader",
        trainerBattleId: "gym-leader-brock",
        trainerClass: "Gym Leader",
        gymId: "gym-01",
        badgeId: "boulder-badge",
        leaderPresentationId: "brock",
      }),
    ).toBe("gym-leader-victory");
  });

  it("keeps defeats on the existing defeat cue", () => {
    expect(resolveBattleOutcomeAudioProfile("trainer-battle-defeat")).toBe("defeat");
  });

  it("does not add another jingle for capture completion", () => {
    expect(resolveBattleOutcomeAudioProfile("wild-captured", { kind: "wild" })).toBe(
      "none",
    );
  });
});
