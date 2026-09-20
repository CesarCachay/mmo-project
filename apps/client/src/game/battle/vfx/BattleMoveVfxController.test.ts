import { describe, expect, it, vi } from "vitest";

import type { BattleMoveVfxRenderer } from "./battle-move-vfx.types";
import { BattleMoveVfxController } from "./BattleMoveVfxController";

function createRenderer(): BattleMoveVfxRenderer {
  return {
    play: vi.fn(() => Promise.resolve()),
    clear: vi.fn(),
  };
}

describe("BattleMoveVfxController", () => {
  it.each([
    [29, "normal", "headbutt"],
    [33, "normal", "tackle"],
    [34, "normal", "body-slam"],
    [36, "normal", "take-down"],
  ] as const)(
    "plays registered contact move %i with the expected preset",
    async (moveId, element, presetId) => {
      const renderer = createRenderer();
      const controller = new BattleMoveVfxController(renderer);

      await controller.play({
        moveId,
        source: { x: 100, y: 200 },
        target: { x: 700, y: 160 },
      });

      expect(renderer.play).toHaveBeenCalledTimes(1);
      expect(renderer.play).toHaveBeenCalledWith(
        expect.objectContaining({
          moveId,
          definition: expect.objectContaining({
            archetype: "contact",
            element,
            presetId,
          }),
        }),
      );
    },
  );

  it.each([
    [5, "normal", "mega-punch"],
    [7, "fire", "fire-punch"],
    [8, "ice", "ice-punch"],
    [9, "electric", "thunder-punch"],
    [10, "normal", "scratch"],
    [24, "fighting", "double-kick"],
    [25, "normal", "mega-kick"],
    [44, "dark", "bite"],
    [163, "normal", "slash"],
    [242, "dark", "crunch"],
    [337, "dragon", "dragon-claw"],
    [421, "ghost", "shadow-claw"],
    [422, "electric", "thunder-fang"],
    [423, "ice", "ice-fang"],
    [424, "fire", "fire-fang"],
  ] as const)(
    "plays registered melee move %i with the expected preset",
    async (moveId, element, presetId) => {
      const renderer = createRenderer();
      const controller = new BattleMoveVfxController(renderer);

      await controller.play({
        moveId,
        source: { x: 100, y: 200 },
        target: { x: 700, y: 160 },
      });

      expect(renderer.play).toHaveBeenCalledTimes(1);
      expect(renderer.play).toHaveBeenCalledWith(
        expect.objectContaining({
          moveId,
          definition: expect.objectContaining({
            archetype: "melee",
            element,
            presetId,
          }),
        }),
      );
    },
  );

  it.each([
    [53, "fire", "flamethrower"],
    [55, "water", "water-gun"],
    [56, "water", "hydro-pump"],
  ] as const)(
    "plays registered stream move %i with the expected preset",
    async (moveId, element, presetId) => {
      const renderer = createRenderer();
      const controller = new BattleMoveVfxController(renderer);

      await controller.play({
        moveId,
        source: { x: 100, y: 200 },
        target: { x: 700, y: 160 },
      });

      expect(renderer.play).toHaveBeenCalledTimes(1);
      expect(renderer.play).toHaveBeenCalledWith(
        expect.objectContaining({
          moveId,
          definition: expect.objectContaining({
            archetype: "stream",
            element,
            presetId,
          }),
        }),
      );
    },
  );

  it.each([
    [52, "fire", "ember"],
    [188, "poison", "sludge-bomb"],
    [247, "ghost", "shadow-ball"],
    [402, "grass", "seed-bomb"],
    [412, "grass", "energy-ball"],
  ] as const)(
    "plays registered projectile move %i with the expected preset",
    async (moveId, element, presetId) => {
      const renderer = createRenderer();
      const controller = new BattleMoveVfxController(renderer);

      await controller.play({
        moveId,
        source: { x: 100, y: 200 },
        target: { x: 700, y: 160 },
      });

      expect(renderer.play).toHaveBeenCalledTimes(1);
      expect(renderer.play).toHaveBeenCalledWith(
        expect.objectContaining({
          moveId,
          definition: expect.objectContaining({
            archetype: "projectile",
            element,
            presetId,
          }),
        }),
      );
    },
  );

  it.each([
    [58, "ice", "ice-beam"],
    [62, "ice", "aurora-beam"],
    [63, "normal", "hyper-beam"],
    [76, "grass", "solar-beam"],
  ] as const)(
    "plays registered beam move %i with the expected preset",
    async (moveId, element, presetId) => {
      const renderer = createRenderer();
      const controller = new BattleMoveVfxController(renderer);

      await controller.play({
        moveId,
        source: { x: 100, y: 200 },
        target: { x: 700, y: 160 },
      });

      expect(renderer.play).toHaveBeenCalledTimes(1);
      expect(renderer.play).toHaveBeenCalledWith(
        expect.objectContaining({
          moveId,
          definition: expect.objectContaining({
            archetype: "beam",
            element,
            presetId,
          }),
        }),
      );
    },
  );


  it.each([
    [42, "bug", "pin-missile"],
    [140, "normal", "barrage"],
    [331, "grass", "bullet-seed"],
    [350, "rock", "rock-blast"],
  ] as const)(
    "plays registered multi-projectile move %i with the expected preset",
    async (moveId, element, presetId) => {
      const renderer = createRenderer();
      const controller = new BattleMoveVfxController(renderer);

      await controller.play({
        moveId,
        source: { x: 100, y: 200 },
        target: { x: 700, y: 160 },
      });

      expect(renderer.play).toHaveBeenCalledTimes(1);
      expect(renderer.play).toHaveBeenCalledWith(
        expect.objectContaining({
          moveId,
          definition: expect.objectContaining({
            archetype: "multi-projectile",
            element,
            presetId,
          }),
        }),
      );
    },
  );

  it.each([
    [120, "normal", "self-destruct"],
    [126, "fire", "fire-blast"],
    [153, "normal", "explosion"],
  ] as const)(
    "plays registered burst move %i with the expected preset",
    async (moveId, element, presetId) => {
      const renderer = createRenderer();
      const controller = new BattleMoveVfxController(renderer);

      await controller.play({
        moveId,
        source: { x: 100, y: 200 },
        target: { x: 700, y: 160 },
      });

      expect(renderer.play).toHaveBeenCalledTimes(1);
      expect(renderer.play).toHaveBeenCalledWith(
        expect.objectContaining({
          moveId,
          definition: expect.objectContaining({
            archetype: "burst",
            element,
            presetId,
          }),
        }),
      );
    },
  );

  it.each([
    [89, "ground", "earthquake"],
    [414, "ground", "earth-power"],
  ] as const)(
    "plays registered ground move %i with the expected preset",
    async (moveId, element, presetId) => {
      const renderer = createRenderer();
      const controller = new BattleMoveVfxController(renderer);

      await controller.play({
        moveId,
        source: { x: 100, y: 200 },
        target: { x: 700, y: 160 },
      });

      expect(renderer.play).toHaveBeenCalledWith(
        expect.objectContaining({
          moveId,
          definition: expect.objectContaining({ archetype: "ground", element, presetId }),
        }),
      );
    },
  );

  it.each([
    [16, "flying", "gust"],
    [57, "water", "surf"],
    [196, "ice", "icy-wind"],
    [257, "fire", "heat-wave"],
    [304, "normal", "hyper-voice"],
    [405, "bug", "bug-buzz"],
  ] as const)(
    "plays registered wave move %i with the expected preset",
    async (moveId, element, presetId) => {
      const renderer = createRenderer();
      const controller = new BattleMoveVfxController(renderer);

      await controller.play({
        moveId,
        source: { x: 100, y: 200 },
        target: { x: 700, y: 160 },
      });

      expect(renderer.play).toHaveBeenCalledWith(
        expect.objectContaining({
          moveId,
          definition: expect.objectContaining({ archetype: "wave", element, presetId }),
        }),
      );
    },
  );

  it.each([
    [157, "rock", "rock-slide"],
    [239, "dragon", "twister"],
    [330, "water", "muddy-water"],
  ] as const)(
    "plays registered aoe move %i with the expected preset",
    async (moveId, element, presetId) => {
      const renderer = createRenderer();
      const controller = new BattleMoveVfxController(renderer);

      await controller.play({
        moveId,
        source: { x: 100, y: 200 },
        target: { x: 700, y: 160 },
      });

      expect(renderer.play).toHaveBeenCalledWith(
        expect.objectContaining({
          moveId,
          definition: expect.objectContaining({ archetype: "aoe", element, presetId }),
        }),
      );
    },
  );



  it.each([
    [14, "normal", "swords-dance"],
    [97, "psychic", "agility"],
    [104, "normal", "double-team"],
    [105, "normal", "recover"],
    [116, "normal", "focus-energy"],
    [156, "psychic", "rest"],
    [268, "electric", "charge"],
    [287, "normal", "refresh"],
    [339, "fighting", "bulk-up"],
    [347, "psychic", "calm-mind"],
    [349, "dragon", "dragon-dance"],
    [355, "flying", "roost"],
  ] as const)(
    "plays registered support move %i with the expected preset",
    async (moveId, element, presetId) => {
      const renderer = createRenderer();
      const controller = new BattleMoveVfxController(renderer);
      await controller.play({ moveId, source: { x: 100, y: 200 }, target: { x: 700, y: 160 } });
      expect(renderer.play).toHaveBeenCalledWith(expect.objectContaining({
        moveId,
        definition: expect.objectContaining({ archetype: "support", element, presetId }),
      }));
    },
  );

  it.each([
    [39, "normal", "tail-whip"],
    [43, "normal", "leer"],
    [45, "normal", "growl"],
    [47, "normal", "sing"],
    [77, "poison", "poison-powder"],
    [78, "grass", "stun-spore"],
    [79, "grass", "sleep-powder"],
    [95, "psychic", "hypnosis"],
    [109, "ghost", "confuse-ray"],
  ] as const)(
    "plays registered status move %i with the expected preset",
    async (moveId, element, presetId) => {
      const renderer = createRenderer();
      const controller = new BattleMoveVfxController(renderer);
      await controller.play({ moveId, source: { x: 100, y: 200 }, target: { x: 700, y: 160 } });
      expect(renderer.play).toHaveBeenCalledWith(expect.objectContaining({
        moveId,
        definition: expect.objectContaining({ archetype: "status", element, presetId }),
      }));
    },
  );

  it.each([
    [113, "psychic", "light-screen"],
    [115, "psychic", "reflect"],
    [219, "normal", "safeguard"],
  ] as const)(
    "plays registered barrier move %i with the expected preset",
    async (moveId, element, presetId) => {
      const renderer = createRenderer();
      const controller = new BattleMoveVfxController(renderer);
      await controller.play({ moveId, source: { x: 100, y: 200 }, target: { x: 700, y: 160 } });
      expect(renderer.play).toHaveBeenCalledWith(expect.objectContaining({
        moveId,
        definition: expect.objectContaining({ archetype: "barrier", element, presetId }),
      }));
    },
  );

  it.each([
    [71, "grass", "absorb"],
    [72, "grass", "mega-drain"],
    [73, "grass", "leech-seed"],
    [202, "grass", "giga-drain"],
    [275, "grass", "ingrain"],
  ] as const)(
    "plays registered tether move %i with the expected preset",
    async (moveId, element, presetId) => {
      const renderer = createRenderer();
      const controller = new BattleMoveVfxController(renderer);
      await controller.play({ moveId, source: { x: 100, y: 200 }, target: { x: 700, y: 160 } });
      expect(renderer.play).toHaveBeenCalledWith(expect.objectContaining({
        moveId,
        definition: expect.objectContaining({ archetype: "tether", element, presetId }),
      }));
    },
  );

  it.each([
    [191, "ground", "spikes"],
    [201, "rock", "sandstorm"],
    [240, "water", "rain-dance"],
    [241, "fire", "sunny-day"],
    [258, "ice", "hail"],
    [356, "psychic", "gravity"],
    [390, "poison", "toxic-spikes"],
    [433, "psychic", "trick-room"],
    [446, "rock", "stealth-rock"],
  ] as const)(
    "plays registered battlefield move %i with the expected preset",
    async (moveId, element, presetId) => {
      const renderer = createRenderer();
      const controller = new BattleMoveVfxController(renderer);
      await controller.play({ moveId, source: { x: 100, y: 200 }, target: { x: 700, y: 160 } });
      expect(renderer.play).toHaveBeenCalledWith(expect.objectContaining({
        moveId,
        definition: expect.objectContaining({ archetype: "battlefield", element, presetId }),
      }));
    },
  );

  it("forwards the optional actor motion hook to contact rendering", async () => {
    const renderer = createRenderer();
    const controller = new BattleMoveVfxController(renderer);
    const actorMotion = {
      playContactMotion: vi.fn(() => Promise.resolve()),
    };

    await controller.play({
      moveId: 33,
      source: { x: 100, y: 200 },
      target: { x: 700, y: 160 },
      actorMotion,
    });

    expect(renderer.play).toHaveBeenCalledWith(
      expect.objectContaining({ actorMotion }),
    );
  });

  it.each([
    [1, "normal", "physical"],
    [13, "normal", "special"],
    [84, "electric", "special"],
    [106, "normal", "status"],
  ] as const)("falls back to generic VFX for registered move %i", async (moveId, element, presetId) => {
    const renderer = createRenderer();
    const controller = new BattleMoveVfxController(renderer);

    await controller.play({
      moveId,
      source: { x: 100, y: 200 },
      target: { x: 700, y: 160 },
    });

    expect(renderer.play).toHaveBeenCalledWith(expect.objectContaining({
      moveId,
      definition: expect.objectContaining({ archetype: "generic", element, presetId }),
    }));
  });

  it("keeps an unknown move id as a no-op", async () => {
    const renderer = createRenderer();
    const controller = new BattleMoveVfxController(renderer);
    await controller.play({ moveId: 999999, source: { x: 100, y: 200 }, target: { x: 700, y: 160 } });
    expect(renderer.play).not.toHaveBeenCalled();
  });
});
