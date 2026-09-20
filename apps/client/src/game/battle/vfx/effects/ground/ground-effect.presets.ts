import type { BattleMoveVfxGroundPresetId } from "../../battle-move-vfx.types";

export type GroundEffectMode = "quake" | "eruption";

export interface GroundEffectPreset {
  readonly mode: GroundEffectMode;
  readonly chargeEnd: number;
  readonly travelEnd: number;
  readonly impactEnd: number;
  readonly groundYRatio: number;
  readonly crackCount: number;
  readonly crackSpread: number;
  readonly ringCount: number;
  readonly eruptionCount: number;
  readonly dustCount: number;
  readonly screenFlashAlpha: number;
  readonly palette: {
    readonly ground: string;
    readonly crack: string;
    readonly glow: string;
    readonly core: string;
    readonly dust: string;
  };
}

const GROUND_EFFECT_PRESETS: Record<BattleMoveVfxGroundPresetId, GroundEffectPreset> = {
  earthquake: {
    mode: "quake",
    chargeEnd: 0.10,
    travelEnd: 0.18,
    impactEnd: 0.88,
    groundYRatio: 0.77,
    crackCount: 10,
    crackSpread: 0.92,
    ringCount: 4,
    eruptionCount: 0,
    dustCount: 18,
    screenFlashAlpha: 0.06,
    palette: {
      ground: "104, 76, 48",
      crack: "239, 180, 96",
      glow: "211, 125, 56",
      core: "255, 226, 158",
      dust: "137, 116, 91",
    },
  },
  "earth-power": {
    mode: "eruption",
    chargeEnd: 0.16,
    travelEnd: 0.58,
    impactEnd: 0.92,
    groundYRatio: 0.79,
    crackCount: 6,
    crackSpread: 0.62,
    ringCount: 3,
    eruptionCount: 7,
    dustCount: 13,
    screenFlashAlpha: 0.10,
    palette: {
      ground: "90, 60, 42",
      crack: "255, 163, 66",
      glow: "226, 96, 38",
      core: "255, 238, 170",
      dust: "121, 91, 70",
    },
  },
};

export function getGroundEffectPreset(presetId: BattleMoveVfxGroundPresetId): GroundEffectPreset {
  return GROUND_EFFECT_PRESETS[presetId];
}
