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
    expect(leader.rewardMoney).toBe(1800);
  });

  it("registers the first gym badge metadata", () => {
    expect(getPokemonGymBadgeDefinition("boulder-badge").displayName).toBe(
      "Boulder Badge",
    );
  });

  it("recognizes known gym ids", () => {
    expect(isPokemonGymId("gym-01")).toBe(true);
    expect(isPokemonGymId("missing-gym")).toBe(false);
  });

  it("recognizes known Gym badge ids", () => {
    expect(isPokemonGymBadgeId("boulder-badge")).toBe(true);
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
