import { describe, expect, it } from "vitest";

import {
  POKEMON_TRAINER_SIGHT_INTERACTION_LATERAL_TOLERANCE_FACTOR,
  checkPokemonTrainerSight,
} from "../src/pokemon/trainers/pokemon-trainer-sight.js";
import type { CollisionMap } from "../src/maps/collision.js";

const OPEN_MAP: CollisionMap = {
  width: 10,
  height: 10,
  tileWidth: 16,
  tileHeight: 16,
  collision: new Array<number>(100).fill(0),
};

describe("checkPokemonTrainerSight", () => {
  it("detects a target in front of the trainer within the configured range", () => {
    const result = checkPokemonTrainerSight({
      trainer: {
        position: { x: 80, y: 48 },
        direction: "down",
        sightRangeTiles: 5,
      },
      target: { x: 80, y: 112 },
      map: OPEN_MAP,
    });

    expect(result.detected).toBe(true);
    expect(result.forwardDistanceTiles).toBe(4);
  });

  it("does not detect a target behind the trainer", () => {
    const result = checkPokemonTrainerSight({
      trainer: {
        position: { x: 80, y: 80 },
        direction: "down",
        sightRangeTiles: 5,
      },
      target: { x: 80, y: 48 },
      map: OPEN_MAP,
    });

    expect(result.detected).toBe(false);
  });

  it("does not detect a target outside the trainer lane", () => {
    const result = checkPokemonTrainerSight({
      trainer: {
        position: { x: 80, y: 48 },
        direction: "down",
        sightRangeTiles: 5,
      },
      target: { x: 96, y: 96 },
      map: OPEN_MAP,
    });

    expect(result.detected).toBe(false);
  });


  it("detects a target one tile off-center when interaction tolerance is enabled", () => {
    const result = checkPokemonTrainerSight({
      trainer: {
        position: { x: 80, y: 48 },
        direction: "down",
        sightRangeTiles: 5,
      },
      target: { x: 96, y: 96 },
      map: OPEN_MAP,
      lateralTolerancePixels:
        OPEN_MAP.tileWidth *
        POKEMON_TRAINER_SIGHT_INTERACTION_LATERAL_TOLERANCE_FACTOR,
    });

    expect(result.detected).toBe(true);
  });

  it("still respects forward collision when lateral tolerance is enabled", () => {
    const collision = new Array<number>(100).fill(0);
    collision[4 * 10 + 5] = 1;

    const result = checkPokemonTrainerSight({
      trainer: {
        position: { x: 80, y: 48 },
        direction: "down",
        sightRangeTiles: 5,
      },
      target: { x: 96, y: 96 },
      map: { ...OPEN_MAP, collision },
      lateralTolerancePixels: 8,
    });

    expect(result.detected).toBe(false);
  });

  it("does not detect beyond sightRangeTiles", () => {
    const result = checkPokemonTrainerSight({
      trainer: {
        position: { x: 80, y: 16 },
        direction: "down",
        sightRangeTiles: 3,
      },
      target: { x: 80, y: 80 },
      map: OPEN_MAP,
    });

    expect(result.detected).toBe(false);
  });

  it("stops line of sight when a collision tile is between trainer and target", () => {
    const collision = new Array<number>(100).fill(0);
    collision[4 * 10 + 5] = 1;

    const result = checkPokemonTrainerSight({
      trainer: {
        position: { x: 80, y: 48 },
        direction: "down",
        sightRangeTiles: 5,
      },
      target: { x: 80, y: 96 },
      map: {
        ...OPEN_MAP,
        collision,
      },
    });

    expect(result.detected).toBe(false);
  });
});
