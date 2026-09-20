import type { BattleMoveVfxStatusPresetId } from "../../battle-move-vfx.types";

export type StatusEffectKind = "debuff" | "song" | "powder" | "hypnosis" | "confusion";

export interface StatusEffectPreset {
  readonly kind: StatusEffectKind;
  readonly particleCount: number;
  readonly radius: number;
  readonly palette: {
    readonly outer: string;
    readonly mid: string;
    readonly inner: string;
    readonly core: string;
    readonly particle: string;
  };
}

const STATUS_EFFECT_PRESETS: Record<BattleMoveVfxStatusPresetId, StatusEffectPreset> = {
  "tail-whip": preset("debuff", "95, 78, 66", "174, 136, 104", "235, 202, 168", "255, 247, 232", "221, 178, 136", 10, 56),
  leer: preset("debuff", "153, 43, 45", "226, 76, 74", "255, 165, 141", "255, 240, 221", "255, 116, 92", 12, 58),
  growl: preset("debuff", "89, 75, 133", "148, 120, 190", "214, 191, 232", "255, 248, 255", "192, 162, 221", 12, 62),
  sing: preset("song", "85, 101, 170", "139, 157, 224", "211, 220, 252", "255, 255, 255", "188, 202, 247", 14, 64),
  "poison-powder": preset("powder", "91, 39, 111", "155, 73, 177", "215, 145, 225", "251, 229, 255", "190, 103, 204", 24, 68),
  "stun-spore": preset("powder", "153, 122, 0", "224, 184, 24", "255, 226, 102", "255, 251, 217", "244, 202, 47", 24, 68),
  "sleep-powder": preset("powder", "46, 107, 88", "81, 170, 137", "174, 229, 205", "244, 255, 249", "132, 208, 176", 24, 68),
  hypnosis: preset("hypnosis", "78, 55, 145", "136, 102, 207", "210, 187, 244", "255, 248, 255", "177, 145, 229", 16, 70),
  "confuse-ray": preset("confusion", "79, 48, 132", "150, 90, 196", "231, 182, 245", "255, 244, 255", "209, 142, 235", 18, 66),
};

function preset(kind: StatusEffectKind, outer: string, mid: string, inner: string, core: string, particle: string, particleCount: number, radius: number): StatusEffectPreset {
  return { kind, particleCount, radius, palette: { outer, mid, inner, core, particle } };
}

export function getStatusEffectPreset(presetId: BattleMoveVfxStatusPresetId): StatusEffectPreset {
  return STATUS_EFFECT_PRESETS[presetId];
}
