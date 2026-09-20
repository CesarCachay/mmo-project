import type { BattleMoveVfxMultiProjectilePresetId } from "../../battle-move-vfx.types";

export type MultiProjectileShape = "seed" | "needle" | "rock" | "orb";

export interface MultiProjectilePalette {
  readonly outer: string;
  readonly inner: string;
  readonly core: string;
  readonly trail: string;
  readonly impact: string;
  readonly particle: string;
}

export interface MultiProjectileEffectPreset {
  readonly id: BattleMoveVfxMultiProjectilePresetId;
  readonly shape: MultiProjectileShape;
  readonly count: number;
  readonly chargeEnd: number;
  readonly volleyEnd: number;
  readonly impactEnd: number;
  readonly radius: number;
  readonly stagger: number;
  readonly spread: number;
  readonly arcHeight: number;
  readonly trailLength: number;
  readonly trailWidth: number;
  readonly impactRadius: number;
  readonly particleCount: number;
  readonly palette: MultiProjectilePalette;
}

const MULTI_PROJECTILE_EFFECT_PRESETS: Readonly<
  Record<BattleMoveVfxMultiProjectilePresetId, MultiProjectileEffectPreset>
> = {
  "bullet-seed": {
    id: "bullet-seed",
    shape: "seed",
    count: 5,
    chargeEnd: 0.06,
    volleyEnd: 0.78,
    impactEnd: 0.94,
    radius: 6,
    stagger: 0.075,
    spread: 18,
    arcHeight: -10,
    trailLength: 28,
    trailWidth: 3,
    impactRadius: 16,
    particleCount: 5,
    palette: {
      outer: "43, 83, 31",
      inner: "104, 176, 73",
      core: "225, 247, 173",
      trail: "116, 191, 77",
      impact: "135, 204, 91",
      particle: "168, 219, 105",
    },
  },
  "pin-missile": {
    id: "pin-missile",
    shape: "needle",
    count: 5,
    chargeEnd: 0.08,
    volleyEnd: 0.76,
    impactEnd: 0.93,
    radius: 5,
    stagger: 0.08,
    spread: 23,
    arcHeight: -5,
    trailLength: 38,
    trailWidth: 2.5,
    impactRadius: 15,
    particleCount: 4,
    palette: {
      outer: "79, 101, 45",
      inner: "181, 202, 99",
      core: "250, 250, 217",
      trail: "200, 216, 121",
      impact: "220, 225, 133",
      particle: "236, 235, 157",
    },
  },
  "rock-blast": {
    id: "rock-blast",
    shape: "rock",
    count: 5,
    chargeEnd: 0.1,
    volleyEnd: 0.8,
    impactEnd: 0.96,
    radius: 9,
    stagger: 0.09,
    spread: 28,
    arcHeight: -42,
    trailLength: 18,
    trailWidth: 3.5,
    impactRadius: 24,
    particleCount: 7,
    palette: {
      outer: "76, 67, 57",
      inner: "142, 123, 97",
      core: "220, 202, 166",
      trail: "133, 115, 91",
      impact: "183, 153, 109",
      particle: "164, 140, 105",
    },
  },
  barrage: {
    id: "barrage",
    shape: "orb",
    count: 5,
    chargeEnd: 0.07,
    volleyEnd: 0.79,
    impactEnd: 0.95,
    radius: 8,
    stagger: 0.085,
    spread: 25,
    arcHeight: -30,
    trailLength: 22,
    trailWidth: 3,
    impactRadius: 19,
    particleCount: 5,
    palette: {
      outer: "118, 79, 48",
      inner: "203, 154, 88",
      core: "255, 231, 174",
      trail: "210, 166, 102",
      impact: "234, 182, 101",
      particle: "220, 185, 128",
    },
  },
};

export function getMultiProjectileEffectPreset(
  presetId: BattleMoveVfxMultiProjectilePresetId,
): MultiProjectileEffectPreset {
  return MULTI_PROJECTILE_EFFECT_PRESETS[presetId];
}
