import type { BattleMoveVfxStreamPresetId } from "../../battle-move-vfx.types";

export type StreamParticleKind = "ember" | "smoke" | "droplet" | "mist";
export type StreamVisualMedium = "fire" | "water";

export interface StreamColorPalette {
  readonly outer: string;
  readonly mid: string;
  readonly inner: string;
  readonly core: string;
  readonly impact: string;
  readonly particlePrimary: string;
  readonly particleSecondary: string;
}

export interface StreamEffectPreset {
  readonly id: BattleMoveVfxStreamPresetId;
  readonly medium: StreamVisualMedium;
  readonly chargeEnd: number;
  readonly travelEnd: number;
  readonly sustainEnd: number;
  readonly sampleSpacing: number;
  readonly startRadius: number;
  readonly endRadius: number;
  readonly frontRadius: number;
  readonly turbulence: number;
  readonly secondaryTurbulence: number;
  readonly primaryParticleKind: StreamParticleKind;
  readonly secondaryParticleKind: StreamParticleKind;
  readonly primaryParticleRate: number;
  readonly secondaryParticleRate: number;
  readonly impactRadius: number;
  readonly impactRayCount: number;
  readonly palette: StreamColorPalette;
}

const STREAM_EFFECT_PRESETS: Readonly<Record<BattleMoveVfxStreamPresetId, StreamEffectPreset>> = {
  flamethrower: {
    id: "flamethrower",
    medium: "fire",
    chargeEnd: 0.14,
    travelEnd: 0.58,
    sustainEnd: 0.84,
    sampleSpacing: 12,
    startRadius: 7,
    endRadius: 27,
    frontRadius: 31,
    turbulence: 10,
    secondaryTurbulence: 4,
    primaryParticleKind: "ember",
    secondaryParticleKind: "smoke",
    primaryParticleRate: 78,
    secondaryParticleRate: 14,
    impactRadius: 38,
    impactRayCount: 10,
    palette: {
      outer: "235, 46, 8",
      mid: "255, 95, 12",
      inner: "255, 170, 24",
      core: "255, 244, 176",
      impact: "255, 129, 18",
      particlePrimary: "255, 148, 24",
      particleSecondary: "66, 55, 52",
    },
  },
  "water-gun": {
    id: "water-gun",
    medium: "water",
    chargeEnd: 0.1,
    travelEnd: 0.66,
    sustainEnd: 0.82,
    sampleSpacing: 10,
    startRadius: 4,
    endRadius: 10,
    frontRadius: 13,
    turbulence: 3.2,
    secondaryTurbulence: 1.8,
    primaryParticleKind: "droplet",
    secondaryParticleKind: "mist",
    primaryParticleRate: 34,
    secondaryParticleRate: 8,
    impactRadius: 23,
    impactRayCount: 8,
    palette: {
      outer: "20, 98, 222",
      mid: "24, 160, 244",
      inner: "81, 211, 255",
      core: "220, 249, 255",
      impact: "75, 208, 255",
      particlePrimary: "88, 213, 255",
      particleSecondary: "188, 238, 255",
    },
  },
  "hydro-pump": {
    id: "hydro-pump",
    medium: "water",
    chargeEnd: 0.12,
    travelEnd: 0.5,
    sustainEnd: 0.82,
    sampleSpacing: 9,
    startRadius: 8,
    endRadius: 24,
    frontRadius: 29,
    turbulence: 5.5,
    secondaryTurbulence: 2.8,
    primaryParticleKind: "droplet",
    secondaryParticleKind: "mist",
    primaryParticleRate: 72,
    secondaryParticleRate: 22,
    impactRadius: 46,
    impactRayCount: 14,
    palette: {
      outer: "10, 69, 189",
      mid: "15, 135, 237",
      inner: "63, 202, 255",
      core: "232, 252, 255",
      impact: "103, 223, 255",
      particlePrimary: "98, 222, 255",
      particleSecondary: "206, 245, 255",
    },
  },
};

export function getStreamEffectPreset(
  presetId: BattleMoveVfxStreamPresetId,
): StreamEffectPreset {
  return STREAM_EFFECT_PRESETS[presetId];
}
