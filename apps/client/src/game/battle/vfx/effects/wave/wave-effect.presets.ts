import type { BattleMoveVfxWavePresetId } from "../../battle-move-vfx.types";

export type WaveEffectKind = "water" | "heat" | "wind" | "sound";
export type WaveParticleKind = "droplet" | "spark" | "flake" | "air" | "note" | "buzz";

export interface WaveEffectPreset {
  readonly kind: WaveEffectKind;
  readonly chargeEnd: number;
  readonly travelEnd: number;
  readonly sustainEnd: number;
  readonly bandWidth: number;
  readonly frontHeight: number;
  readonly wavelength: number;
  readonly amplitude: number;
  readonly bandCount: number;
  readonly particleCount: number;
  readonly particleKind: WaveParticleKind;
  readonly impactRadius: number;
  readonly palette: {
    readonly outer: string;
    readonly mid: string;
    readonly inner: string;
    readonly core: string;
    readonly particle: string;
  };
}

const WAVE_EFFECT_PRESETS: Record<BattleMoveVfxWavePresetId, WaveEffectPreset> = {
  surf: {
    kind: "water",
    chargeEnd: 0.08,
    travelEnd: 0.67,
    sustainEnd: 0.88,
    bandWidth: 74,
    frontHeight: 96,
    wavelength: 54,
    amplitude: 14,
    bandCount: 4,
    particleCount: 24,
    particleKind: "droplet",
    impactRadius: 72,
    palette: {
      outer: "18, 90, 174",
      mid: "36, 152, 224",
      inner: "101, 210, 247",
      core: "231, 251, 255",
      particle: "164, 235, 255",
    },
  },
  "heat-wave": {
    kind: "heat",
    chargeEnd: 0.10,
    travelEnd: 0.68,
    sustainEnd: 0.90,
    bandWidth: 68,
    frontHeight: 88,
    wavelength: 42,
    amplitude: 11,
    bandCount: 5,
    particleCount: 26,
    particleKind: "spark",
    impactRadius: 66,
    palette: {
      outer: "171, 45, 18",
      mid: "240, 90, 28",
      inner: "255, 166, 55",
      core: "255, 246, 190",
      particle: "255, 134, 35",
    },
  },
  "icy-wind": {
    kind: "wind",
    chargeEnd: 0.08,
    travelEnd: 0.70,
    sustainEnd: 0.90,
    bandWidth: 54,
    frontHeight: 70,
    wavelength: 58,
    amplitude: 13,
    bandCount: 5,
    particleCount: 20,
    particleKind: "flake",
    impactRadius: 54,
    palette: {
      outer: "64, 137, 190",
      mid: "113, 194, 226",
      inner: "188, 235, 249",
      core: "245, 253, 255",
      particle: "219, 248, 255",
    },
  },
  gust: {
    kind: "wind",
    chargeEnd: 0.06,
    travelEnd: 0.66,
    sustainEnd: 0.84,
    bandWidth: 44,
    frontHeight: 60,
    wavelength: 64,
    amplitude: 16,
    bandCount: 4,
    particleCount: 12,
    particleKind: "air",
    impactRadius: 46,
    palette: {
      outer: "135, 164, 177",
      mid: "184, 210, 219",
      inner: "223, 239, 244",
      core: "255, 255, 255",
      particle: "234, 247, 250",
    },
  },
  "hyper-voice": {
    kind: "sound",
    chargeEnd: 0.12,
    travelEnd: 0.64,
    sustainEnd: 0.88,
    bandWidth: 48,
    frontHeight: 68,
    wavelength: 50,
    amplitude: 9,
    bandCount: 6,
    particleCount: 12,
    particleKind: "note",
    impactRadius: 60,
    palette: {
      outer: "112, 79, 155",
      mid: "175, 129, 207",
      inner: "222, 190, 238",
      core: "255, 246, 255",
      particle: "232, 201, 255",
    },
  },
  "bug-buzz": {
    kind: "sound",
    chargeEnd: 0.09,
    travelEnd: 0.63,
    sustainEnd: 0.88,
    bandWidth: 52,
    frontHeight: 72,
    wavelength: 34,
    amplitude: 7,
    bandCount: 7,
    particleCount: 18,
    particleKind: "buzz",
    impactRadius: 62,
    palette: {
      outer: "79, 112, 27",
      mid: "135, 165, 45",
      inner: "194, 213, 87",
      core: "244, 250, 190",
      particle: "194, 220, 74",
    },
  },
};

export function getWaveEffectPreset(presetId: BattleMoveVfxWavePresetId): WaveEffectPreset {
  return WAVE_EFFECT_PRESETS[presetId];
}
