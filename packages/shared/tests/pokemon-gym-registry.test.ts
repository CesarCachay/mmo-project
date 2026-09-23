import { describe, expect, it } from "vitest";

import {
  POKEMON_GYM_REGISTRY,
  getPokemonGymBadgeDefinition,
  getPokemonGymDefinition,
  isPokemonGymBadgeId,
  isPokemonGymId,
} from "../src/pokemon/trainers/pokemon-gym.registry.js";
import { getPokemonTrainerBattleDefinition } from "../src/pokemon/trainers/pokemon-trainer-battle.registry.js";

describe("POKEMON_GYM_REGISTRY", () => {
  it("registers gym-01 with Brock as a gym leader battle", () => {
    const gym = getPokemonGymDefinition("gym-01");
    const leader = getPokemonTrainerBattleDefinition("gym-leader-brock");

    expect(gym.mapId).toBe("gym-01");
    expect(gym.leaderTrainerBattleId).toBe("gym-leader-brock");
    expect(gym.leaderPresentationId).toBe("brock");
    expect(leader.category).toBe("gym-leader");
    expect(leader.gymLeader).toEqual({
      gymId: "gym-01",
      badgeId: "boulder-badge",
      leaderPresentationId: "brock",
    });
    expect(leader.rewardMoney).toBe(2800);
  });

  it("registers gym-02 with Misty as a gym leader battle", () => {
    const gym = getPokemonGymDefinition("gym-02");
    const leader = getPokemonTrainerBattleDefinition("gym-leader-misty");

    expect(gym.mapId).toBe("gym-02");
    expect(gym.leaderTrainerBattleId).toBe("gym-leader-misty");
    expect(gym.leaderPresentationId).toBe("misty");
    expect(leader.category).toBe("gym-leader");
    expect(leader.gymLeader).toEqual({
      gymId: "gym-02",
      badgeId: "cascade-badge",
      leaderPresentationId: "misty",
    });
    expect(leader.rewardMoney).toBe(3400);
  });

  it("registers Gym badge metadata", () => {
    expect(getPokemonGymBadgeDefinition("boulder-badge").displayName).toBe(
      "Boulder Badge"
    );
    expect(getPokemonGymBadgeDefinition("cascade-badge").displayName).toBe(
      "Cascade Badge"
    );
  });

  it("recognizes known gym ids", () => {
    expect(isPokemonGymId("gym-01")).toBe(true);
    expect(isPokemonGymId("gym-02")).toBe(true);
    expect(isPokemonGymId("missing-gym")).toBe(false);
  });

  it("recognizes known Gym badge ids", () => {
    expect(isPokemonGymBadgeId("boulder-badge")).toBe(true);
    expect(isPokemonGymBadgeId("cascade-badge")).toBe(true);
    expect(isPokemonGymBadgeId("fake-badge")).toBe(false);
  });

  it("keeps every registered Gym consistent with its Trainer Battle metadata", () => {
    for (const gym of Object.values(POKEMON_GYM_REGISTRY)) {
      const leader = getPokemonTrainerBattleDefinition(gym.leaderTrainerBattleId);

      expect(leader.category).toBe("gym-leader");
      expect(leader.gymLeader).toEqual({
        gymId: gym.id,
        badgeId: gym.badgeId,
        leaderPresentationId: gym.leaderPresentationId,
      });
      expect(isPokemonGymBadgeId(gym.badgeId)).toBe(true);
    }
  });
});
