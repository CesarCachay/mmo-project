import type { BattleMoveVfxBurstPresetId } from "../../battle-move-vfx.types";

export type BurstOrigin = "target" | "source";
export type BurstKind = "fire-flare" | "shockwave";

export interface BurstEffectPalette {
  readonly outer: string;
  readonly mid: string;
  readonly inner: string;
  readonly core: string;
  readonly ray: string;
  readonly smoke: string;
}

export interface BurstEffectPreset {
  readonly id: BattleMoveVfxBurstPresetId;
  readonly origin: BurstOrigin;
  readonly kind: BurstKind;
  readonly chargeEnd: number;
  readonly travelEnd: number;
  readonly burstEnd: number;
  readonly travelRadius: number;
  readonly burstRadius: number;
  readonly ringCount: number;
  readonly rayCount: number;
  readonly smokeCount: number;
  readonly screenFlashAlpha: number;
  readonly palette: BurstEffectPalette;
}

const BURST_EFFECT_PRESETS: Readonly<Record<BattleMoveVfxBurstPresetId, BurstEffectPreset>> = {
  "fire-blast": {
    id: "fire-blast",
    origin: "target",
    kind: "fire-flare",
    chargeEnd: 0.12,
    travelEnd: 0.55,
    burstEnd: 0.91,
    travelRadius: 14,
    burstRadius: 68,
    ringCount: 2,
    rayCount: 18,
    smokeCount: 8,
    screenFlashAlpha: 0.08,
    palette: {
      outer: "160, 35, 10",
      mid: "239, 78, 15",
      inner: "255, 166, 26",
      core: "255, 245, 194",
      ray: "255, 128, 19",
      smoke: "91, 54, 45",
    },
  },
  "self-destruct": {
    id: "self-destruct",
    origin: "source",
    kind: "shockwave",
    chargeEnd: 0.23,
    travelEnd: 0.23,
    burstEnd: 0.9,
    travelRadius: 0,
    burstRadius: 92,
    ringCount: 3,
    rayCount: 24,
    smokeCount: 12,
    screenFlashAlpha: 0.14,
    palette: {
      outer: "118, 86, 48",
      mid: "235, 146, 55",
      inner: "255, 205, 92",
      core: "255, 250, 223",
      ray: "255, 183, 76",
      smoke: "92, 82, 70",
    },
  },
  explosion: {
    id: "explosion",
    origin: "source",
    kind: "shockwave",
    chargeEnd: 0.18,
    travelEnd: 0.18,
    burstEnd: 0.94,
    travelRadius: 0,
    burstRadius: 126,
    ringCount: 4,
    rayCount: 32,
    smokeCount: 16,
    screenFlashAlpha: 0.22,
    palette: {
      outer: "130, 48, 20",
      mid: "238, 100, 32",
      inner: "255, 185, 58",
      core: "255, 252, 225",
      ray: "255, 148, 31",
      smoke: "78, 68, 63",
    },
  },
};

export function getBurstEffectPreset(presetId: BattleMoveVfxBurstPresetId): BurstEffectPreset {
  return BURST_EFFECT_PRESETS[presetId];
}
