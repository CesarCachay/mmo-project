import type { BattleMoveVfxSupportPresetId } from "../../battle-move-vfx.types";

export type SupportEffectKind = "buff" | "heal" | "focus" | "speed" | "evasion" | "cleanse" | "rest";

export interface SupportEffectPreset {
  readonly kind: SupportEffectKind;
  readonly ringCount: number;
  readonly particleCount: number;
  readonly rise: number;
  readonly radius: number;
  readonly palette: {
    readonly outer: string;
    readonly mid: string;
    readonly inner: string;
    readonly core: string;
    readonly particle: string;
  };
}

const SUPPORT_EFFECT_PRESETS: Record<BattleMoveVfxSupportPresetId, SupportEffectPreset> = {
  "swords-dance": preset("buff", "86, 116, 157", "170, 202, 230", "245, 249, 255", "255, 255, 255", "214, 232, 250", 3, 10, 76, 58),
  agility: preset("speed", "58, 117, 171", "98, 191, 224", "195, 239, 250", "255, 255, 255", "165, 229, 249", 3, 16, 68, 54),
  "double-team": preset("evasion", "112, 112, 130", "183, 190, 209", "238, 242, 250", "255, 255, 255", "221, 230, 247", 4, 12, 52, 62),
  recover: preset("heal", "33, 143, 93", "81, 204, 137", "176, 246, 207", "247, 255, 251", "152, 240, 194", 3, 18, 82, 64),
  "focus-energy": preset("focus", "179, 92, 25", "237, 149, 48", "255, 215, 121", "255, 250, 226", "255, 190, 72", 4, 14, 62, 58),
  rest: preset("rest", "71, 84, 156", "123, 139, 211", "206, 214, 248", "252, 252, 255", "192, 203, 246", 3, 10, 42, 60),
  charge: preset("focus", "157, 119, 0", "237, 190, 28", "255, 233, 111", "255, 253, 224", "255, 218, 54", 4, 18, 64, 62),
  refresh: preset("cleanse", "28, 133, 140", "62, 196, 195", "174, 243, 235", "247, 255, 253", "129, 233, 221", 4, 16, 76, 66),
  "bulk-up": preset("buff", "142, 49, 38", "218, 91, 64", "252, 176, 138", "255, 244, 231", "240, 126, 91", 4, 15, 72, 62),
  "calm-mind": preset("focus", "85, 56, 157", "151, 113, 211", "220, 198, 245", "255, 249, 255", "199, 165, 239", 5, 16, 58, 66),
  "dragon-dance": preset("buff", "70, 61, 165", "105, 112, 225", "189, 192, 250", "252, 250, 255", "144, 145, 242", 4, 18, 78, 70),
  roost: preset("heal", "101, 124, 132", "169, 196, 201", "226, 243, 244", "255, 255, 255", "211, 236, 239", 3, 14, 58, 64),
};

function preset(
  kind: SupportEffectKind,
  outer: string,
  mid: string,
  inner: string,
  core: string,
  particle: string,
  ringCount: number,
  particleCount: number,
  rise: number,
  radius: number,
): SupportEffectPreset {
  return { kind, ringCount, particleCount, rise, radius, palette: { outer, mid, inner, core, particle } };
}

export function getSupportEffectPreset(presetId: BattleMoveVfxSupportPresetId): SupportEffectPreset {
  return SUPPORT_EFFECT_PRESETS[presetId];
}
