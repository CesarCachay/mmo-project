import { describe, expect, it } from "vitest";

import {
  MAP_DATA_REGISTRY,
  getPokemonGymDefinition,
  getPokemonTrainerBattleDefinition,
} from "../src/index.js";

describe("Gym Leader map integration", () => {
  it("places Brock inside gym-01 and links him to the Gym Leader battle definition", () => {
    const gym = getPokemonGymDefinition("gym-01");
    const map = MAP_DATA_REGISTRY[gym.mapId];
    const npc = map.npcs.brock;
    const battle = getPokemonTrainerBattleDefinition(gym.leaderTrainerBattleId);

    expect(npc).toEqual({
      x: 256,
      y: 160,
      trainerBattleId: "gym-leader-brock",
      direction: "down",
      sightRangeTiles: 1,
    });
    expect(battle.category).toBe("gym-leader");
    expect(battle.gymLeader?.leaderPresentationId).toBe("brock");
  });

  it("places Misty inside gym-02 and links her to the Gym Leader battle definition", () => {
    const gym = getPokemonGymDefinition("gym-02");
    const map = MAP_DATA_REGISTRY[gym.mapId];
    const npc = map.npcs.misty;
    const battle = getPokemonTrainerBattleDefinition(gym.leaderTrainerBattleId);

    expect(npc).toEqual({
      x: 256,
      y: 80,
      trainerBattleId: "gym-leader-misty",
      direction: "down",
      sightRangeTiles: 1,
    });
    expect(map.npcs.gym02SwimmerMarina?.trainerBattleId).toBe("swimmer-marina");
    expect(map.npcs.gym02SailorNico?.trainerBattleId).toBe("sailor-nico");
    expect(battle.category).toBe("gym-leader");
    expect(battle.gymLeader?.leaderPresentationId).toBe("misty");
    expect(battle.gymLeader?.badgeId).toBe("cascade-badge");
  });

});
