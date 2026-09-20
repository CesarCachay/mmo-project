import type { BattleMoveVfxProjectilePresetId } from "../../battle-move-vfx.types";

export type ProjectileParticleKind =
  | "ember"
  | "spark"
  | "wisp"
  | "spore"
  | "leaf"
  | "sludge";

export type ProjectileVisualShape =
  | "fire-orb"
  | "shadow-orb"
  | "energy-orb"
  | "sludge-orb"
  | "seed";

export interface ProjectileColorPalette {
  readonly outer: string;
  readonly mid: string;
  readonly inner: string;
  readonly core: string;
  readonly trail: string;
  readonly impact: string;
  readonly particle: string;
}

export interface ProjectileEffectPreset {
  readonly id: BattleMoveVfxProjectilePresetId;
  readonly shape: ProjectileVisualShape;
  readonly chargeEnd: number;
  readonly travelEnd: number;
  readonly impactEnd: number;
  readonly radius: number;
  readonly trailLength: number;
  readonly trailWidth: number;
  readonly arcHeight: number;
  readonly wobble: number;
  readonly spinSpeed: number;
  readonly particleKind: ProjectileParticleKind;
  readonly particleRate: number;
  readonly impactRadius: number;
  readonly impactRayCount: number;
  readonly palette: ProjectileColorPalette;
}

const PROJECTILE_EFFECT_PRESETS: Readonly<
  Record<BattleMoveVfxProjectilePresetId, ProjectileEffectPreset>
> = {
  ember: {
    id: "ember",
    shape: "fire-orb",
    chargeEnd: 0.08,
    travelEnd: 0.7,
    impactEnd: 0.9,
    radius: 9,
    trailLength: 48,
    trailWidth: 7,
    arcHeight: -4,
    wobble: 2.5,
    spinSpeed: 0.01,
    particleKind: "ember",
    particleRate: 42,
    impactRadius: 24,
    impactRayCount: 8,
    palette: {
      outer: "226, 54, 10",
      mid: "255, 105, 16",
      inner: "255, 183, 38",
      core: "255, 246, 184",
      trail: "255, 119, 20",
      impact: "255, 143, 22",
      particle: "255, 166, 32",
    },
  },
  "shadow-ball": {
    id: "shadow-ball",
    shape: "shadow-orb",
    chargeEnd: 0.18,
    travelEnd: 0.68,
    impactEnd: 0.91,
    radius: 17,
    trailLength: 70,
    trailWidth: 13,
    arcHeight: -10,
    wobble: 7,
    spinSpeed: 0.016,
    particleKind: "wisp",
    particleRate: 34,
    impactRadius: 38,
    impactRayCount: 11,
    palette: {
      outer: "48, 16, 74",
      mid: "95, 40, 142",
      inner: "157, 84, 213",
      core: "227, 190, 255",
      trail: "120, 55, 169",
      impact: "178, 101, 227",
      particle: "191, 126, 232",
    },
  },
  "energy-ball": {
    id: "energy-ball",
    shape: "energy-orb",
    chargeEnd: 0.16,
    travelEnd: 0.69,
    impactEnd: 0.91,
    radius: 16,
    trailLength: 66,
    trailWidth: 11,
    arcHeight: -8,
    wobble: 4,
    spinSpeed: 0.018,
    particleKind: "leaf",
    particleRate: 30,
    impactRadius: 36,
    impactRayCount: 12,
    palette: {
      outer: "24, 92, 42",
      mid: "51, 166, 72",
      inner: "119, 221, 97",
      core: "231, 255, 196",
      trail: "79, 192, 76",
      impact: "126, 229, 104",
      particle: "126, 218, 87",
    },
  },
  "sludge-bomb": {
    id: "sludge-bomb",
    shape: "sludge-orb",
    chargeEnd: 0.11,
    travelEnd: 0.67,
    impactEnd: 0.93,
    radius: 15,
    trailLength: 45,
    trailWidth: 12,
    arcHeight: -28,
    wobble: 5,
    spinSpeed: 0.012,
    particleKind: "sludge",
    particleRate: 24,
    impactRadius: 40,
    impactRayCount: 9,
    palette: {
      outer: "70, 18, 83",
      mid: "133, 42, 153",
      inner: "190, 82, 201",
      core: "244, 188, 246",
      trail: "121, 45, 137",
      impact: "183, 69, 195",
      particle: "166, 69, 178",
    },
  },
  "seed-bomb": {
    id: "seed-bomb",
    shape: "seed",
    chargeEnd: 0.06,
    travelEnd: 0.72,
    impactEnd: 0.91,
    radius: 12,
    trailLength: 34,
    trailWidth: 5,
    arcHeight: -42,
    wobble: 1.5,
    spinSpeed: 0.024,
    particleKind: "spore",
    particleRate: 18,
    impactRadius: 34,
    impactRayCount: 10,
    palette: {
      outer: "42, 69, 24",
      mid: "88, 125, 47",
      inner: "149, 184, 78",
      core: "231, 242, 161",
      trail: "97, 139, 54",
      impact: "143, 184, 75",
      particle: "164, 201, 91",
    },
  },
};

export function getProjectileEffectPreset(
  presetId: BattleMoveVfxProjectilePresetId,
): ProjectileEffectPreset {
  return PROJECTILE_EFFECT_PRESETS[presetId];
}
