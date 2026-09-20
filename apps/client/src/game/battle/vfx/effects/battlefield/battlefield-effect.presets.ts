import type { BattleMoveVfxBattlefieldPresetId } from "../../battle-move-vfx.types";

export type BattlefieldEffectKind = "weather" | "hazard" | "distortion";
export type BattlefieldParticleKind = "rain" | "sun" | "sand" | "hail" | "spike" | "toxic-spike" | "rock" | "grid" | "gravity";

export interface BattlefieldEffectPreset {
  readonly kind: BattlefieldEffectKind;
  readonly particleKind: BattlefieldParticleKind;
  readonly particleCount: number;
  readonly intensity: number;
  readonly palette: {
    readonly outer: string;
    readonly mid: string;
    readonly inner: string;
    readonly core: string;
    readonly particle: string;
  };
}

const PRESETS: Record<BattleMoveVfxBattlefieldPresetId, BattlefieldEffectPreset> = {
  "rain-dance": preset("weather", "rain", 56, 1, "26, 75, 130", "62, 136, 199", "139, 207, 244", "235, 249, 255", "157, 220, 249"),
  "sunny-day": preset("weather", "sun", 28, 1, "192, 91, 8", "244, 153, 28", "255, 214, 93", "255, 251, 216", "255, 203, 72"),
  sandstorm: preset("weather", "sand", 64, 1.1, "105, 78, 43", "166, 128, 71", "218, 183, 119", "252, 233, 184", "207, 166, 96"),
  hail: preset("weather", "hail", 46, 1, "67, 115, 142", "111, 175, 205", "189, 230, 246", "248, 254, 255", "213, 243, 255"),
  spikes: preset("hazard", "spike", 9, 1, "73, 57, 44", "126, 98, 70", "190, 153, 109", "244, 221, 178", "167, 128, 86"),
  "toxic-spikes": preset("hazard", "toxic-spike", 9, 1, "73, 27, 92", "135, 54, 158", "201, 113, 216", "249, 224, 252", "183, 87, 199"),
  "stealth-rock": preset("hazard", "rock", 8, 1.15, "70, 61, 55", "119, 102, 88", "177, 153, 126", "238, 220, 190", "153, 129, 102"),
  "trick-room": preset("distortion", "grid", 20, 1, "72, 42, 126", "129, 82, 188", "205, 161, 235", "255, 240, 255", "185, 127, 224"),
  gravity: preset("distortion", "gravity", 30, 1, "56, 42, 105", "103, 80, 164", "178, 151, 220", "247, 238, 255", "155, 128, 205"),
};

function preset(kind: BattlefieldEffectKind, particleKind: BattlefieldParticleKind, particleCount: number, intensity: number, outer: string, mid: string, inner: string, core: string, particle: string): BattlefieldEffectPreset {
  return { kind, particleKind, particleCount, intensity, palette: { outer, mid, inner, core, particle } };
}

export function getBattlefieldEffectPreset(id: BattleMoveVfxBattlefieldPresetId): BattlefieldEffectPreset {
  return PRESETS[id];
}
