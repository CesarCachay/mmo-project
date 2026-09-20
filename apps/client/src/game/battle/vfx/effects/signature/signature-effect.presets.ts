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
  | "shadow-force";

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
};

export function getSignatureEffectPreset(
  presetId: BattleMoveVfxSignaturePresetId,
): SignatureEffectPreset {
  return PRESETS[presetId];
}
