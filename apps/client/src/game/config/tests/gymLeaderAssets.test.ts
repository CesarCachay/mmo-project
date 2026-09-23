import { describe, expect, it } from "vitest";

import { getGymLeaderAssetDefinition } from "../gymLeaderAssets";

describe("gymLeaderAssets", () => {
  it("uses leader-intro.png for Brock presentation", () => {
    expect(getGymLeaderAssetDefinition("brock")).toEqual({
      folder: "/assets/characters/leaders/brock",
      overworldAppearanceId: "gym-leader-brock",
      introImageUrl: "/assets/characters/leaders/brock/leader-intro.png",
    });
  });

  it.each([
    "misty",
    "surge",
    "erika",
    "koga",
    "sabrina",
    "giovanni",
  ] as const)("pre-registers %s leader-intro assets for future gyms", (leaderId) => {
    const asset = getGymLeaderAssetDefinition(leaderId);

    expect(asset.folder).toBe(`/assets/characters/leaders/${leaderId}`);
    expect(asset.introImageUrl).toBe(
      `/assets/characters/leaders/${leaderId}/leader-intro.png`,
    );
    expect(asset.overworldAppearanceId).toBe(`gym-leader-${leaderId}`);
  });
});
