import { describe, expect, it } from "vitest";

import { MAP_IDS } from "@cesar-mmo/shared";

import { MAP_DATA_REGISTRY } from "@cesar-mmo/shared";

const HEALING_STATION_ID = "pokeCenterHealingStation01";

describe("Pokémon Center healing station map data", () => {
  it("exposes the Pokémon Center healing station on a reachable map cell", () => {
    const map = MAP_DATA_REGISTRY[MAP_IDS.POKE_CENTER];

    const station = map.healingStations[HEALING_STATION_ID];

    expect(station).toBeDefined();

    if (!station) {
      throw new Error(`Healing station "${HEALING_STATION_ID}" was not generated`);
    }

    expect(Number.isFinite(station.x)).toBe(true);

    expect(Number.isFinite(station.y)).toBe(true);

    expect(station.x).toBeGreaterThanOrEqual(0);

    expect(station.x).toBeLessThan(map.widthInPixels);

    expect(station.y).toBeGreaterThanOrEqual(0);

    expect(station.y).toBeLessThan(map.heightInPixels);

    const tileX = Math.floor(station.x / map.tileWidth);

    const tileY = Math.floor(station.y / map.tileHeight);

    const collisionIndex = tileY * map.width + tileX;

    expect(map.collision[collisionIndex]).toBe(0);
  });
});
