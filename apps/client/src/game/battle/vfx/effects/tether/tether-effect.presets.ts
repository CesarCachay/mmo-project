import type { BattleMoveVfxTetherPresetId } from "../../battle-move-vfx.types";

export type TetherEffectKind = "drain" | "seed" | "roots";

export interface TetherEffectPreset {
  readonly kind: TetherEffectKind;
  readonly strandCount: number;
  readonly particleCount: number;
  readonly width: number;
  readonly palette: {
    readonly outer: string;
    readonly mid: string;
    readonly inner: string;
    readonly core: string;
    readonly particle: string;
  };
}

const TETHER_EFFECT_PRESETS: Record<BattleMoveVfxTetherPresetId, TetherEffectPreset> = {
  absorb: preset("drain", 2, 12, 2.2, "37, 115, 69", "67, 172, 99", "149, 226, 162", "239, 255, 241", "120, 214, 139"),
  "mega-drain": preset("drain", 3, 18, 3.2, "28, 105, 58", "59, 174, 91", "137, 226, 151", "245, 255, 246", "105, 218, 129"),
  "leech-seed": preset("seed", 3, 16, 2.8, "75, 92, 31", "116, 153, 52", "183, 215, 103", "248, 255, 218", "154, 195, 80"),
  "giga-drain": preset("drain", 5, 28, 4.5, "19, 87, 49", "44, 159, 82", "115, 222, 136", "240, 255, 240", "85, 218, 111"),
  ingrain: preset("roots", 5, 20, 3.6, "78, 61, 30", "125, 97, 43", "167, 142, 74", "233, 220, 153", "123, 177, 84"),
};

function preset(kind: TetherEffectKind, strandCount: number, particleCount: number, width: number, outer: string, mid: string, inner: string, core: string, particle: string): TetherEffectPreset {
  return { kind, strandCount, particleCount, width, palette: { outer, mid, inner, core, particle } };
}

export function getTetherEffectPreset(presetId: BattleMoveVfxTetherPresetId): TetherEffectPreset {
  return TETHER_EFFECT_PRESETS[presetId];
}
