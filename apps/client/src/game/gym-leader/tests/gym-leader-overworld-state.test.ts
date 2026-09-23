import { describe, expect, it } from "vitest";

import {
  getGymLeaderOverworldLabelPresentation,
  getTrainerBattleInteractionPrompt,
} from "../gym-leader-overworld-state";

describe("Gym Leader overworld state", () => {
  it("offers an explicit challenge interaction before defeating a Gym Leader", () => {
    expect(getTrainerBattleInteractionPrompt("gym-leader-brock", false)).toBe(
      "Desafiar",
    );
  });

  it("switches a defeated Gym Leader to post-battle dialogue", () => {
    expect(getTrainerBattleInteractionPrompt("gym-leader-brock", true)).toBe(
      "Hablar",
    );
  });

  it("does not turn standard undefeated Trainer Sight NPCs into manual challenges", () => {
    expect(getTrainerBattleInteractionPrompt("student-gary", false)).toBeUndefined();
  });

  it("allows manual dialogue with defeated standard Trainers", () => {
    expect(getTrainerBattleInteractionPrompt("student-gary", true)).toBe(
      "Hablar",
    );
  });

  it("marks a defeated Gym Leader in the overworld without changing standard Trainers", () => {
    expect(
      getGymLeaderOverworldLabelPresentation({
        displayName: "Brock",
        trainerBattleId: "gym-leader-brock",
        defeatedTrainerBattleIds: new Set(["gym-leader-brock"]),
      }),
    ).toEqual({
      text: "Brock ✓",
      completed: true,
    });

    expect(
      getGymLeaderOverworldLabelPresentation({
        displayName: "Gary",
        trainerBattleId: "student-gary",
        defeatedTrainerBattleIds: new Set(["student-gary"]),
      }),
    ).toEqual({
      text: "Gary",
      completed: false,
    });
  });
});
