import type { BattleMoveVfxSignaturePresetId } from "../../battle-move-vfx.types";

export type SignatureVisualStyle =
  | "lightning-bolt"
  | "thunder"
  | "blizzard"
  | "psychic"
  | "aura-sphere"
  | "dark-pulse"
  | "dragon-pulse"
  | "focus-blast"
  | "brave-bird"
  | "close-combat"
  | "leaf-storm"
  | "draco-meteor"
  | "air-slash"
  | "flash-cannon"
  | "stone-edge"
  | "shadow-force"
  | "water-gun-retro"
  | "razor-leaf-retro"
  | "absorb-retro"
  | "giga-drain-retro"
  | "flame-wheel-retro"
  | "quick-attack-retro"
  | "scary-face-retro"
  | "rage-retro"
  | "vine-whip-retro"
  | "bubble-retro"
  | "dragon-rage-retro"
  | "thunder-shock-retro"
  | "cut-retro"
  | "fly-retro"
  | "surf-retro"
  | "strength-retro"
  | "waterfall-retro"
  | "rock-smash-retro"
  | "whirlpool-retro"
  | "rock-climb-retro"
  | "defog-retro";

export interface SignatureEffectPalette {
  readonly primary: string;
  readonly secondary: string;
  readonly core: string;
  readonly accent: string;
  readonly shadow: string;
}

export interface SignatureEffectPreset {
  readonly id: BattleMoveVfxSignaturePresetId;
  readonly style: SignatureVisualStyle;
  readonly chargeEnd: number;
  readonly travelEnd: number;
  readonly impactEnd: number;
  readonly intensity: number;
  readonly palette: SignatureEffectPalette;
}

const PRESETS: Readonly<Record<BattleMoveVfxSignaturePresetId, SignatureEffectPreset>> = {
  thunderbolt: {
    id: "thunderbolt", style: "lightning-bolt", chargeEnd: 0.14, travelEnd: 0.62, impactEnd: 0.88, intensity: 0.82,
    palette: { primary: "255, 219, 42", secondary: "255, 245, 138", core: "255, 255, 247", accent: "255, 176, 0", shadow: "90, 69, 9" },
  },
  thunder: {
    id: "thunder", style: "thunder", chargeEnd: 0.24, travelEnd: 0.55, impactEnd: 0.9, intensity: 1,
    palette: { primary: "255, 218, 31", secondary: "255, 247, 155", core: "255, 255, 255", accent: "255, 159, 0", shadow: "53, 43, 12" },
  },
  blizzard: {
    id: "blizzard", style: "blizzard", chargeEnd: 0.13, travelEnd: 0.72, impactEnd: 0.92, intensity: 1,
    palette: { primary: "102, 217, 255", secondary: "201, 247, 255", core: "250, 255, 255", accent: "75, 154, 222", shadow: "42, 92, 126" },
  },
  psychic: {
    id: "psychic", style: "psychic", chargeEnd: 0.18, travelEnd: 0.48, impactEnd: 0.9, intensity: 0.9,
    palette: { primary: "225, 82, 219", secondary: "255, 150, 232", core: "255, 237, 255", accent: "123, 83, 255", shadow: "72, 30, 105" },
  },
  "aura-sphere": {
    id: "aura-sphere", style: "aura-sphere", chargeEnd: 0.23, travelEnd: 0.7, impactEnd: 0.91, intensity: 0.85,
    palette: { primary: "45, 140, 255", secondary: "104, 210, 255", core: "237, 252, 255", accent: "37, 84, 214", shadow: "20, 44, 94" },
  },
  "dark-pulse": {
    id: "dark-pulse", style: "dark-pulse", chargeEnd: 0.16, travelEnd: 0.72, impactEnd: 0.91, intensity: 0.84,
    palette: { primary: "99, 57, 142", secondary: "167, 92, 196", core: "230, 195, 245", accent: "44, 29, 67", shadow: "21, 13, 34" },
  },
  "dragon-pulse": {
    id: "dragon-pulse", style: "dragon-pulse", chargeEnd: 0.18, travelEnd: 0.7, impactEnd: 0.91, intensity: 0.88,
    palette: { primary: "99, 99, 255", secondary: "161, 91, 255", core: "234, 219, 255", accent: "45, 206, 225", shadow: "45, 31, 105" },
  },
  "focus-blast": {
    id: "focus-blast", style: "focus-blast", chargeEnd: 0.3, travelEnd: 0.72, impactEnd: 0.93, intensity: 1,
    palette: { primary: "237, 108, 49", secondary: "255, 191, 88", core: "255, 246, 217", accent: "194, 54, 35", shadow: "93, 35, 24" },
  },
  "brave-bird": {
    id: "brave-bird", style: "brave-bird", chargeEnd: 0.14, travelEnd: 0.61, impactEnd: 0.9, intensity: 1,
    palette: { primary: "43, 168, 255", secondary: "134, 224, 255", core: "250, 255, 255", accent: "34, 91, 190", shadow: "20, 42, 88" },
  },
  "close-combat": {
    id: "close-combat", style: "close-combat", chargeEnd: 0.12, travelEnd: 0.48, impactEnd: 0.93, intensity: 1,
    palette: { primary: "234, 84, 51", secondary: "255, 162, 76", core: "255, 245, 225", accent: "183, 32, 28", shadow: "92, 27, 23" },
  },
  "leaf-storm": {
    id: "leaf-storm", style: "leaf-storm", chargeEnd: 0.18, travelEnd: 0.68, impactEnd: 0.93, intensity: 1,
    palette: { primary: "68, 181, 74", secondary: "143, 224, 87", core: "235, 255, 205", accent: "38, 116, 53", shadow: "24, 67, 35" },
  },
  "draco-meteor": {
    id: "draco-meteor", style: "draco-meteor", chargeEnd: 0.24, travelEnd: 0.68, impactEnd: 0.95, intensity: 1,
    palette: { primary: "123, 76, 255", secondary: "224, 87, 255", core: "255, 229, 255", accent: "255, 119, 60", shadow: "44, 23, 89" },
  },
  "air-slash": {
    id: "air-slash", style: "air-slash", chargeEnd: 0.08, travelEnd: 0.68, impactEnd: 0.88, intensity: 0.75,
    palette: { primary: "172, 236, 255", secondary: "228, 250, 255", core: "255, 255, 255", accent: "82, 168, 214", shadow: "40, 88, 120" },
  },
  "flash-cannon": {
    id: "flash-cannon", style: "flash-cannon", chargeEnd: 0.24, travelEnd: 0.5, impactEnd: 0.88, intensity: 0.86,
    palette: { primary: "174, 194, 211", secondary: "227, 239, 247", core: "255, 255, 255", accent: "94, 132, 157", shadow: "51, 69, 82" },
  },
  "stone-edge": {
    id: "stone-edge", style: "stone-edge", chargeEnd: 0.14, travelEnd: 0.52, impactEnd: 0.93, intensity: 0.95,
    palette: { primary: "137, 110, 72", secondary: "198, 167, 115", core: "244, 221, 174", accent: "87, 69, 52", shadow: "49, 40, 32" },
  },
  "shadow-force": {
    id: "shadow-force", style: "shadow-force", chargeEnd: 0.32, travelEnd: 0.68, impactEnd: 0.94, intensity: 1,
    palette: { primary: "93, 49, 139", secondary: "174, 83, 208", core: "235, 192, 255", accent: "38, 21, 62", shadow: "12, 8, 24" },
  },
  "water-gun-retro": {
    id: "water-gun-retro", style: "water-gun-retro", chargeEnd: 0.08, travelEnd: 0.7, impactEnd: 0.9, intensity: 0.72,
    palette: { primary: "38, 153, 255", secondary: "92, 211, 255", core: "232, 252, 255", accent: "16, 99, 219", shadow: "18, 67, 132" },
  },
  "razor-leaf-retro": {
    id: "razor-leaf-retro", style: "razor-leaf-retro", chargeEnd: 0.1, travelEnd: 0.72, impactEnd: 0.92, intensity: 0.82,
    palette: { primary: "52, 154, 67", secondary: "126, 213, 97", core: "233, 255, 194", accent: "31, 108, 45", shadow: "24, 67, 30" },
  },
  "absorb-retro": {
    id: "absorb-retro", style: "absorb-retro", chargeEnd: 0.12, travelEnd: 0.76, impactEnd: 0.94, intensity: 0.58,
    palette: { primary: "81, 191, 91", secondary: "147, 229, 133", core: "241, 255, 228", accent: "45, 132, 67", shadow: "26, 73, 38" },
  },
  "giga-drain-retro": {
    id: "giga-drain-retro", style: "giga-drain-retro", chargeEnd: 0.16, travelEnd: 0.74, impactEnd: 0.95, intensity: 0.95,
    palette: { primary: "33, 154, 72", secondary: "104, 222, 115", core: "236, 255, 225", accent: "180, 239, 87", shadow: "18, 73, 39" },
  },
  "flame-wheel-retro": {
    id: "flame-wheel-retro", style: "flame-wheel-retro", chargeEnd: 0.18, travelEnd: 0.7, impactEnd: 0.93, intensity: 0.94,
    palette: { primary: "255, 83, 24", secondary: "255, 166, 34", core: "255, 245, 182", accent: "224, 38, 12", shadow: "92, 28, 16" },
  },
  "quick-attack-retro": {
    id: "quick-attack-retro", style: "quick-attack-retro", chargeEnd: 0.08, travelEnd: 0.55, impactEnd: 0.82, intensity: 0.82,
    palette: { primary: "238, 245, 255", secondary: "175, 215, 255", core: "255, 255, 255", accent: "102, 167, 224", shadow: "61, 78, 101" },
  },
  "scary-face-retro": {
    id: "scary-face-retro", style: "scary-face-retro", chargeEnd: 0.16, travelEnd: 0.48, impactEnd: 0.92, intensity: 0.84,
    palette: { primary: "111, 25, 38", secondary: "220, 45, 48", core: "255, 221, 143", accent: "255, 50, 32", shadow: "20, 8, 16" },
  },
  "rage-retro": {
    id: "rage-retro", style: "rage-retro", chargeEnd: 0.28, travelEnd: 0.68, impactEnd: 0.91, intensity: 0.88,
    palette: { primary: "223, 52, 38", secondary: "255, 124, 43", core: "255, 229, 171", accent: "161, 20, 26", shadow: "76, 18, 18" },
  },
  "vine-whip-retro": {
    id: "vine-whip-retro", style: "vine-whip-retro", chargeEnd: 0.08, travelEnd: 0.68, impactEnd: 0.9, intensity: 0.82,
    palette: { primary: "51, 151, 58", secondary: "108, 205, 83", core: "231, 255, 190", accent: "31, 102, 37", shadow: "20, 65, 27" },
  },
  "bubble-retro": {
    id: "bubble-retro", style: "bubble-retro", chargeEnd: 0.08, travelEnd: 0.73, impactEnd: 0.92, intensity: 0.7,
    palette: { primary: "73, 174, 235", secondary: "156, 226, 255", core: "244, 254, 255", accent: "50, 118, 197", shadow: "24, 73, 122" },
  },
  "dragon-rage-retro": {
    id: "dragon-rage-retro", style: "dragon-rage-retro", chargeEnd: 0.18, travelEnd: 0.7, impactEnd: 0.93, intensity: 0.9,
    palette: { primary: "98, 82, 220", secondary: "171, 84, 230", core: "240, 221, 255", accent: "62, 192, 226", shadow: "42, 28, 105" },
  },
  "thunder-shock-retro": {
    id: "thunder-shock-retro", style: "thunder-shock-retro", chargeEnd: 0.08, travelEnd: 0.62, impactEnd: 0.86, intensity: 0.7,
    palette: { primary: "255, 218, 50", secondary: "255, 244, 130", core: "255, 255, 245", accent: "244, 164, 0", shadow: "98, 76, 10" },
  },
  "cut-retro": {
    id: "cut-retro", style: "cut-retro", chargeEnd: 0.08, travelEnd: 0.62, impactEnd: 0.88, intensity: 0.72,
    palette: { primary: "233, 245, 241", secondary: "173, 213, 196", core: "255, 255, 255", accent: "120, 168, 149", shadow: "59, 82, 73" },
  },
  "fly-retro": {
    id: "fly-retro", style: "fly-retro", chargeEnd: 0.18, travelEnd: 0.68, impactEnd: 0.92, intensity: 0.9,
    palette: { primary: "173, 232, 255", secondary: "227, 248, 255", core: "255, 255, 255", accent: "96, 168, 229", shadow: "36, 76, 118" },
  },
  "surf-retro": {
    id: "surf-retro", style: "surf-retro", chargeEnd: 0.18, travelEnd: 0.74, impactEnd: 0.95, intensity: 1,
    palette: { primary: "42, 147, 235", secondary: "95, 206, 255", core: "236, 252, 255", accent: "19, 94, 201", shadow: "14, 55, 107" },
  },
  "strength-retro": {
    id: "strength-retro", style: "strength-retro", chargeEnd: 0.16, travelEnd: 0.64, impactEnd: 0.9, intensity: 0.82,
    palette: { primary: "224, 183, 96", secondary: "245, 221, 156", core: "255, 248, 227", accent: "166, 114, 54", shadow: "84, 56, 28" },
  },
  "waterfall-retro": {
    id: "waterfall-retro", style: "waterfall-retro", chargeEnd: 0.1, travelEnd: 0.7, impactEnd: 0.93, intensity: 0.86,
    palette: { primary: "58, 170, 255", secondary: "160, 229, 255", core: "247, 254, 255", accent: "36, 109, 221", shadow: "17, 64, 132" },
  },
  "rock-smash-retro": {
    id: "rock-smash-retro", style: "rock-smash-retro", chargeEnd: 0.12, travelEnd: 0.54, impactEnd: 0.88, intensity: 0.82,
    palette: { primary: "189, 140, 79", secondary: "226, 192, 130", core: "255, 241, 217", accent: "133, 88, 43", shadow: "70, 45, 27" },
  },
  "whirlpool-retro": {
    id: "whirlpool-retro", style: "whirlpool-retro", chargeEnd: 0.1, travelEnd: 0.72, impactEnd: 0.96, intensity: 0.86,
    palette: { primary: "71, 170, 233", secondary: "149, 225, 255", core: "242, 253, 255", accent: "26, 111, 197", shadow: "16, 61, 116" },
  },
  "rock-climb-retro": {
    id: "rock-climb-retro", style: "rock-climb-retro", chargeEnd: 0.14, travelEnd: 0.62, impactEnd: 0.91, intensity: 0.86,
    palette: { primary: "161, 128, 88", secondary: "218, 188, 138", core: "247, 231, 192", accent: "102, 77, 49", shadow: "55, 40, 30" },
  },
  "defog-retro": {
    id: "defog-retro", style: "defog-retro", chargeEnd: 0.08, travelEnd: 0.58, impactEnd: 0.92, intensity: 0.66,
    palette: { primary: "197, 236, 244", secondary: "232, 248, 252", core: "255, 255, 255", accent: "123, 183, 214", shadow: "64, 103, 120" },
  },


};

export function getSignatureEffectPreset(
  presetId: BattleMoveVfxSignaturePresetId,
): SignatureEffectPreset {
  return PRESETS[presetId];
}
