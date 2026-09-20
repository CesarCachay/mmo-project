import type { BattleMoveVfxContactPresetId } from "../../battle-move-vfx.types";

export type ContactMotionStyle = "dash" | "headbutt" | "slam" | "reckless";

export interface ContactEffectPalette {
  readonly charge: string;
  readonly speedLine: string;
  readonly impact: string;
  readonly core: string;
  readonly dust: string;
}

export interface ContactEffectPreset {
  readonly style: ContactMotionStyle;
  readonly windupEnd: number;
  readonly dashEnd: number;
  readonly impactHoldEnd: number;
  readonly travelRatio: number;
  readonly windupDistance: number;
  readonly arcHeight: number;
  readonly speedLineCount: number;
  readonly speedLineLength: number;
  readonly impactRadius: number;
  readonly impactRayCount: number;
  readonly palette: ContactEffectPalette;
}

const CONTACT_EFFECT_PRESETS: Readonly<
  Record<BattleMoveVfxContactPresetId, ContactEffectPreset>
> = {
  tackle: {
    style: "dash",
    windupEnd: 0.18,
    dashEnd: 0.5,
    impactHoldEnd: 0.64,
    travelRatio: 0.68,
    windupDistance: 10,
    arcHeight: 0,
    speedLineCount: 7,
    speedLineLength: 42,
    impactRadius: 34,
    impactRayCount: 10,
    palette: {
      charge: "226, 232, 240",
      speedLine: "241, 245, 249",
      impact: "203, 213, 225",
      core: "255, 255, 255",
      dust: "148, 163, 184",
    },
  },
  headbutt: {
    style: "headbutt",
    windupEnd: 0.23,
    dashEnd: 0.51,
    impactHoldEnd: 0.68,
    travelRatio: 0.72,
    windupDistance: 16,
    arcHeight: 6,
    speedLineCount: 9,
    speedLineLength: 50,
    impactRadius: 43,
    impactRayCount: 14,
    palette: {
      charge: "226, 232, 240",
      speedLine: "248, 250, 252",
      impact: "251, 191, 36",
      core: "255, 251, 235",
      dust: "161, 98, 7",
    },
  },
  "body-slam": {
    style: "slam",
    windupEnd: 0.22,
    dashEnd: 0.56,
    impactHoldEnd: 0.72,
    travelRatio: 0.74,
    windupDistance: 8,
    arcHeight: 34,
    speedLineCount: 10,
    speedLineLength: 46,
    impactRadius: 55,
    impactRayCount: 16,
    palette: {
      charge: "226, 232, 240",
      speedLine: "241, 245, 249",
      impact: "244, 114, 182",
      core: "255, 241, 242",
      dust: "120, 113, 108",
    },
  },
  "take-down": {
    style: "reckless",
    windupEnd: 0.15,
    dashEnd: 0.44,
    impactHoldEnd: 0.6,
    travelRatio: 0.8,
    windupDistance: 12,
    arcHeight: 4,
    speedLineCount: 14,
    speedLineLength: 64,
    impactRadius: 61,
    impactRayCount: 20,
    palette: {
      charge: "254, 215, 170",
      speedLine: "255, 237, 213",
      impact: "249, 115, 22",
      core: "255, 247, 237",
      dust: "180, 83, 9",
    },
  },
};

export function getContactEffectPreset(
  presetId: BattleMoveVfxContactPresetId,
): ContactEffectPreset {
  return CONTACT_EFFECT_PRESETS[presetId];
}
