import type { BattleMoveVfxMeleePresetId } from "../../battle-move-vfx.types";

export type MeleeEffectFamily = "slash" | "claw" | "punch" | "kick" | "bite";
export type MeleeElementAccent =
  | "none"
  | "fire"
  | "ice"
  | "electric"
  | "dark"
  | "dragon"
  | "ghost";

export interface MeleeEffectPalette {
  readonly primary: string;
  readonly secondary: string;
  readonly core: string;
  readonly accent: string;
}

export interface MeleeEffectPreset {
  readonly family: MeleeEffectFamily;
  readonly accent: MeleeElementAccent;
  readonly windupEnd: number;
  readonly dashEnd: number;
  readonly impactHoldEnd: number;
  readonly travelRatio: number;
  readonly windupDistance: number;
  readonly arcHeight: number;
  readonly impactRadius: number;
  readonly strokeWidth: number;
  readonly markCount: number;
  readonly hitCount: number;
  readonly particleCount: number;
  readonly palette: MeleeEffectPalette;
}

const NORMAL = {
  primary: "248, 250, 252",
  secondary: "203, 213, 225",
  core: "255, 255, 255",
  accent: "148, 163, 184",
} as const;

const CONTACT_TIMING = {
  windupEnd: 0.2,
  dashEnd: 0.48,
  impactHoldEnd: 0.72,
} as const;

const MELEE_EFFECT_PRESETS: Readonly<
  Record<BattleMoveVfxMeleePresetId, MeleeEffectPreset>
> = {
  scratch: {
    family: "claw",
    accent: "none",
    ...CONTACT_TIMING,
    travelRatio: 0.44,
    windupDistance: 7,
    arcHeight: 0,
    impactRadius: 30,
    strokeWidth: 3,
    markCount: 3,
    hitCount: 1,
    particleCount: 5,
    palette: NORMAL,
  },
  slash: {
    family: "slash",
    accent: "none",
    windupEnd: 0.18,
    dashEnd: 0.46,
    impactHoldEnd: 0.74,
    travelRatio: 0.48,
    windupDistance: 9,
    arcHeight: 3,
    impactRadius: 44,
    strokeWidth: 5,
    markCount: 2,
    hitCount: 1,
    particleCount: 8,
    palette: {
      primary: "255, 255, 255",
      secondary: "226, 232, 240",
      core: "255, 255, 255",
      accent: "148, 163, 184",
    },
  },
  "dragon-claw": {
    family: "claw",
    accent: "dragon",
    windupEnd: 0.22,
    dashEnd: 0.5,
    impactHoldEnd: 0.76,
    travelRatio: 0.5,
    windupDistance: 10,
    arcHeight: 5,
    impactRadius: 50,
    strokeWidth: 5.5,
    markCount: 3,
    hitCount: 1,
    particleCount: 13,
    palette: {
      primary: "129, 140, 248",
      secondary: "99, 102, 241",
      core: "238, 242, 255",
      accent: "167, 139, 250",
    },
  },
  "shadow-claw": {
    family: "claw",
    accent: "ghost",
    windupEnd: 0.22,
    dashEnd: 0.5,
    impactHoldEnd: 0.78,
    travelRatio: 0.5,
    windupDistance: 10,
    arcHeight: 4,
    impactRadius: 49,
    strokeWidth: 5,
    markCount: 3,
    hitCount: 1,
    particleCount: 14,
    palette: {
      primary: "167, 139, 250",
      secondary: "109, 40, 217",
      core: "245, 243, 255",
      accent: "76, 29, 149",
    },
  },
  "mega-punch": {
    family: "punch",
    accent: "none",
    windupEnd: 0.24,
    dashEnd: 0.51,
    impactHoldEnd: 0.75,
    travelRatio: 0.52,
    windupDistance: 12,
    arcHeight: 2,
    impactRadius: 52,
    strokeWidth: 5,
    markCount: 1,
    hitCount: 1,
    particleCount: 12,
    palette: {
      primary: "254, 240, 138",
      secondary: "250, 204, 21",
      core: "255, 255, 255",
      accent: "161, 98, 7",
    },
  },
  "fire-punch": {
    family: "punch",
    accent: "fire",
    windupEnd: 0.22,
    dashEnd: 0.5,
    impactHoldEnd: 0.77,
    travelRatio: 0.5,
    windupDistance: 10,
    arcHeight: 2,
    impactRadius: 49,
    strokeWidth: 5,
    markCount: 1,
    hitCount: 1,
    particleCount: 16,
    palette: {
      primary: "251, 146, 60",
      secondary: "239, 68, 68",
      core: "255, 247, 237",
      accent: "250, 204, 21",
    },
  },
  "ice-punch": {
    family: "punch",
    accent: "ice",
    windupEnd: 0.22,
    dashEnd: 0.5,
    impactHoldEnd: 0.77,
    travelRatio: 0.5,
    windupDistance: 10,
    arcHeight: 2,
    impactRadius: 49,
    strokeWidth: 5,
    markCount: 1,
    hitCount: 1,
    particleCount: 14,
    palette: {
      primary: "103, 232, 249",
      secondary: "14, 165, 233",
      core: "240, 253, 255",
      accent: "186, 230, 253",
    },
  },
  "thunder-punch": {
    family: "punch",
    accent: "electric",
    windupEnd: 0.2,
    dashEnd: 0.47,
    impactHoldEnd: 0.75,
    travelRatio: 0.5,
    windupDistance: 9,
    arcHeight: 2,
    impactRadius: 50,
    strokeWidth: 5,
    markCount: 1,
    hitCount: 1,
    particleCount: 18,
    palette: {
      primary: "253, 224, 71",
      secondary: "250, 204, 21",
      core: "255, 255, 235",
      accent: "245, 158, 11",
    },
  },
  "double-kick": {
    family: "kick",
    accent: "none",
    windupEnd: 0.16,
    dashEnd: 0.43,
    impactHoldEnd: 0.8,
    travelRatio: 0.46,
    windupDistance: 8,
    arcHeight: 10,
    impactRadius: 36,
    strokeWidth: 4,
    markCount: 2,
    hitCount: 2,
    particleCount: 8,
    palette: {
      primary: "253, 186, 116",
      secondary: "249, 115, 22",
      core: "255, 247, 237",
      accent: "154, 52, 18",
    },
  },
  "mega-kick": {
    family: "kick",
    accent: "none",
    windupEnd: 0.26,
    dashEnd: 0.52,
    impactHoldEnd: 0.78,
    travelRatio: 0.54,
    windupDistance: 14,
    arcHeight: 15,
    impactRadius: 60,
    strokeWidth: 7,
    markCount: 1,
    hitCount: 1,
    particleCount: 16,
    palette: {
      primary: "254, 215, 170",
      secondary: "249, 115, 22",
      core: "255, 255, 255",
      accent: "124, 45, 18",
    },
  },
  bite: {
    family: "bite",
    accent: "dark",
    windupEnd: 0.18,
    dashEnd: 0.46,
    impactHoldEnd: 0.76,
    travelRatio: 0.48,
    windupDistance: 7,
    arcHeight: 0,
    impactRadius: 40,
    strokeWidth: 4,
    markCount: 2,
    hitCount: 1,
    particleCount: 8,
    palette: {
      primary: "148, 163, 184",
      secondary: "71, 85, 105",
      core: "248, 250, 252",
      accent: "30, 41, 59",
    },
  },
  crunch: {
    family: "bite",
    accent: "dark",
    windupEnd: 0.22,
    dashEnd: 0.49,
    impactHoldEnd: 0.8,
    travelRatio: 0.5,
    windupDistance: 10,
    arcHeight: 0,
    impactRadius: 53,
    strokeWidth: 6,
    markCount: 2,
    hitCount: 1,
    particleCount: 13,
    palette: {
      primary: "129, 140, 248",
      secondary: "49, 46, 129",
      core: "238, 242, 255",
      accent: "15, 23, 42",
    },
  },
  "fire-fang": {
    family: "bite",
    accent: "fire",
    windupEnd: 0.2,
    dashEnd: 0.48,
    impactHoldEnd: 0.79,
    travelRatio: 0.49,
    windupDistance: 9,
    arcHeight: 0,
    impactRadius: 48,
    strokeWidth: 5,
    markCount: 2,
    hitCount: 1,
    particleCount: 15,
    palette: {
      primary: "251, 146, 60",
      secondary: "220, 38, 38",
      core: "255, 247, 237",
      accent: "250, 204, 21",
    },
  },
  "ice-fang": {
    family: "bite",
    accent: "ice",
    windupEnd: 0.2,
    dashEnd: 0.48,
    impactHoldEnd: 0.79,
    travelRatio: 0.49,
    windupDistance: 9,
    arcHeight: 0,
    impactRadius: 48,
    strokeWidth: 5,
    markCount: 2,
    hitCount: 1,
    particleCount: 13,
    palette: {
      primary: "125, 211, 252",
      secondary: "14, 165, 233",
      core: "240, 253, 255",
      accent: "224, 242, 254",
    },
  },
  "thunder-fang": {
    family: "bite",
    accent: "electric",
    windupEnd: 0.18,
    dashEnd: 0.45,
    impactHoldEnd: 0.78,
    travelRatio: 0.49,
    windupDistance: 8,
    arcHeight: 0,
    impactRadius: 49,
    strokeWidth: 5,
    markCount: 2,
    hitCount: 1,
    particleCount: 17,
    palette: {
      primary: "253, 224, 71",
      secondary: "234, 179, 8",
      core: "255, 255, 235",
      accent: "245, 158, 11",
    },
  },
};

export function getMeleeEffectPreset(
  presetId: BattleMoveVfxMeleePresetId,
): MeleeEffectPreset {
  return MELEE_EFFECT_PRESETS[presetId];
}
