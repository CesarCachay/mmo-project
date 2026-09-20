import type { BattleMoveVfxBeamPresetId } from "../../battle-move-vfx.types";

export type BeamParticleKind = "crystal" | "prism" | "spark" | "solar-mote";
export type BeamVisualStyle = "ice" | "aurora" | "hyper" | "solar";

export interface BeamEffectPalette {
  readonly outer: string;
  readonly mid: string;
  readonly inner: string;
  readonly core: string;
  readonly particle: string;
  readonly impact: string;
  readonly accents: readonly string[];
}

export interface BeamEffectPreset {
  readonly style: BeamVisualStyle;
  readonly chargeEnd: number;
  readonly travelEnd: number;
  readonly sustainEnd: number;
  readonly chargeRadius: number;
  readonly outerWidth: number;
  readonly midWidth: number;
  readonly coreWidth: number;
  readonly pulseAmount: number;
  readonly waveAmplitude: number;
  readonly waveFrequency: number;
  readonly particleKind: BeamParticleKind;
  readonly particleRate: number;
  readonly impactRadius: number;
  readonly impactRayCount: number;
  readonly palette: BeamEffectPalette;
}

const BEAM_EFFECT_PRESETS: Record<BattleMoveVfxBeamPresetId, BeamEffectPreset> = {
  "ice-beam": {
    style: "ice",
    chargeEnd: 0.18,
    travelEnd: 0.43,
    sustainEnd: 0.78,
    chargeRadius: 15,
    outerWidth: 18,
    midWidth: 10,
    coreWidth: 3.4,
    pulseAmount: 0.08,
    waveAmplitude: 1.7,
    waveFrequency: 5.4,
    particleKind: "crystal",
    particleRate: 28,
    impactRadius: 34,
    impactRayCount: 12,
    palette: {
      outer: "63, 181, 223",
      mid: "113, 218, 241",
      inner: "190, 244, 255",
      core: "248, 254, 255",
      particle: "181, 241, 255",
      impact: "125, 224, 248",
      accents: ["96, 207, 238", "197, 246, 255"],
    },
  },
  "aurora-beam": {
    style: "aurora",
    chargeEnd: 0.2,
    travelEnd: 0.46,
    sustainEnd: 0.8,
    chargeRadius: 17,
    outerWidth: 24,
    midWidth: 13,
    coreWidth: 3.2,
    pulseAmount: 0.12,
    waveAmplitude: 4.4,
    waveFrequency: 4.2,
    particleKind: "prism",
    particleRate: 32,
    impactRadius: 38,
    impactRayCount: 14,
    palette: {
      outer: "92, 126, 255",
      mid: "91, 221, 214",
      inner: "209, 167, 255",
      core: "250, 247, 255",
      particle: "236, 205, 255",
      impact: "138, 218, 246",
      accents: [
        "92, 217, 255",
        "112, 238, 178",
        "206, 151, 255",
        "255, 178, 222",
      ],
    },
  },
  "hyper-beam": {
    style: "hyper",
    chargeEnd: 0.3,
    travelEnd: 0.48,
    sustainEnd: 0.82,
    chargeRadius: 25,
    outerWidth: 38,
    midWidth: 22,
    coreWidth: 7,
    pulseAmount: 0.18,
    waveAmplitude: 2.8,
    waveFrequency: 8.2,
    particleKind: "spark",
    particleRate: 48,
    impactRadius: 58,
    impactRayCount: 20,
    palette: {
      outer: "242, 131, 38",
      mid: "255, 188, 56",
      inner: "255, 234, 132",
      core: "255, 255, 247",
      particle: "255, 211, 84",
      impact: "255, 176, 47",
      accents: ["255, 114, 40", "255, 226, 103"],
    },
  },
  "solar-beam": {
    style: "solar",
    chargeEnd: 0.34,
    travelEnd: 0.52,
    sustainEnd: 0.84,
    chargeRadius: 27,
    outerWidth: 34,
    midWidth: 20,
    coreWidth: 6,
    pulseAmount: 0.14,
    waveAmplitude: 1.4,
    waveFrequency: 5.8,
    particleKind: "solar-mote",
    particleRate: 42,
    impactRadius: 54,
    impactRayCount: 18,
    palette: {
      outer: "77, 171, 62",
      mid: "157, 218, 72",
      inner: "224, 241, 112",
      core: "255, 255, 218",
      particle: "196, 235, 92",
      impact: "201, 235, 91",
      accents: ["99, 199, 72", "246, 239, 105"],
    },
  },
};

export function getBeamEffectPreset(
  presetId: BattleMoveVfxBeamPresetId,
): BeamEffectPreset {
  return BEAM_EFFECT_PRESETS[presetId];
}
