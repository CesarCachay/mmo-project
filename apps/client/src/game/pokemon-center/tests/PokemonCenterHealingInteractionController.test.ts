import { MAP_DATA_REGISTRY, MAP_IDS } from "@cesar-mmo/shared";

import { describe, expect, it } from "vitest";

import { findNearestPokemonCenterHealingStation } from "../pokemon-center-healing-target";

const HEALING_STATION_ID = "pokeCenterHealingStation01";

describe("PokemonCenterHealingInteractionController target selection", () => {
  it("finds the healing station only while the player is inside interaction range", () => {
    const station =
      MAP_DATA_REGISTRY[MAP_IDS.POKE_CENTER].healingStations[HEALING_STATION_ID];

    if (!station) {
      throw new Error(`Healing station "${HEALING_STATION_ID}" is missing`);
    }

    expect(
      findNearestPokemonCenterHealingStation(MAP_IDS.POKE_CENTER, station.x, station.y)
    ).toEqual({
      id: HEALING_STATION_ID,

      x: station.x,
      y: station.y,
    });

    expect(
      findNearestPokemonCenterHealingStation(
        MAP_IDS.POKE_CENTER,
        station.x + 37,
        station.y
      )
    ).toBeUndefined();
  });
});
