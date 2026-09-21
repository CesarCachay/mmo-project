import { describe, expect, it } from "vitest";

import { MAP_DATA_REGISTRY } from "../src/mapDataRegistry.js";
import { isPokemonTrainerBattleId } from "../src/pokemon/trainers/pokemon-trainer-battle.registry.js";

describe("trainer NPC map integration", () => {
  it("registers the initial route-01 trainers", () => {
    const route = MAP_DATA_REGISTRY["route-01"];

    expect(route.npcs.studentGary).toEqual({
      x: 400,
      y: 240,
      trainerBattleId: "student-gary",
      direction: "down",
      sightRangeTiles: 5,
    });

    expect(route.npcs.studentFrancisca).toEqual({
      x: 560,
      y: 240,
      trainerBattleId: "student-francisca",
      direction: "down",
      sightRangeTiles: 5,
    });
  });

  it("registers four progressive Trainer NPCs on route-02", () => {
    const route = MAP_DATA_REGISTRY["route-02"];

    expect(route.npcs.route02YoungsterDiego).toEqual({
      x: 240,
      y: 512,
      trainerBattleId: "youngster-diego",
      direction: "down",
      sightRangeTiles: 4,
    });

    expect(route.npcs.route02PicnickerValeria).toEqual({
      x: 320,
      y: 400,
      trainerBattleId: "picnicker-valeria",
      direction: "left",
      sightRangeTiles: 5,
    });

    expect(route.npcs.route02HikerMarcos).toEqual({
      x: 496,
      y: 304,
      trainerBattleId: "hiker-marcos",
      direction: "left",
      sightRangeTiles: 5,
    });

    expect(route.npcs.route02AceTrainerLucia).toEqual({
      x: 624,
      y: 176,
      trainerBattleId: "ace-trainer-lucia",
      direction: "down",
      sightRangeTiles: 5,
    });
  });

  it("does not aggro Diego at the route-02 spawn but detects after advancing", async () => {
    const { checkPokemonTrainerSight } = await import(
      "../src/pokemon/trainers/pokemon-trainer-sight.js"
    );
    const route = MAP_DATA_REGISTRY["route-02"];
    const diego = route.npcs.route02YoungsterDiego;

    expect(
      checkPokemonTrainerSight({
        trainer: {
          position: { x: diego.x, y: diego.y },
          direction: diego.direction,
          sightRangeTiles: diego.sightRangeTiles,
        },
        target: route.spawn,
        map: route,
      }).detected,
    ).toBe(false);

    expect(
      checkPokemonTrainerSight({
        trainer: {
          position: { x: diego.x, y: diego.y },
          direction: diego.direction,
          sightRangeTiles: diego.sightRangeTiles,
        },
        target: { x: 240, y: 576 },
        map: route,
      }).detected,
    ).toBe(true);
  });

  it("keeps Gary outside sight at the route spawn but detects after advancing", async () => {
    const { checkPokemonTrainerSight } = await import(
      "../src/pokemon/trainers/pokemon-trainer-sight.js"
    );
    const route = MAP_DATA_REGISTRY["route-01"];
    const gary = route.npcs.studentGary;

    expect(
      checkPokemonTrainerSight({
        trainer: {
          position: { x: gary.x, y: gary.y },
          direction: gary.direction,
          sightRangeTiles: gary.sightRangeTiles,
        },
        target: route.spawn,
        map: route,
      }).detected,
    ).toBe(false);

    expect(
      checkPokemonTrainerSight({
        trainer: {
          position: { x: gary.x, y: gary.y },
          direction: gary.direction,
          sightRangeTiles: gary.sightRangeTiles,
        },
        target: { x: 400, y: 320 },
        map: route,
      }).detected,
    ).toBe(true);
  });

  it("keeps every map trainerBattleId aligned with the trainer battle registry", () => {
    for (const map of Object.values(MAP_DATA_REGISTRY)) {
      for (const npc of Object.values(map.npcs)) {
        if (!("trainerBattleId" in npc)) {
          continue;
        }

        expect(isPokemonTrainerBattleId(npc.trainerBattleId)).toBe(true);
        expect(npc.sightRangeTiles).toBeGreaterThan(0);
      }
    }
  });
});
