import type { BattleMoveVfxBarrierPresetId } from "../../battle-move-vfx.types";

export interface BarrierEffectPreset {
  readonly panelCount: number;
  readonly width: number;
  readonly height: number;
  readonly tilt: number;
  readonly palette: {
    readonly outer: string;
    readonly mid: string;
    readonly inner: string;
    readonly core: string;
  };
}

const BARRIER_EFFECT_PRESETS: Record<BattleMoveVfxBarrierPresetId, BarrierEffectPreset> = {
  "light-screen": { panelCount: 3, width: 92, height: 116, tilt: -0.12, palette: { outer: "184, 144, 40", mid: "245, 207, 76", inner: "255, 237, 156", core: "255, 254, 235" } },
  reflect: { panelCount: 3, width: 96, height: 120, tilt: 0.12, palette: { outer: "104, 55, 151", mid: "174, 101, 210", inner: "231, 184, 243", core: "255, 245, 255" } },
  safeguard: { panelCount: 5, width: 108, height: 126, tilt: 0, palette: { outer: "40, 132, 104", mid: "78, 197, 157", inner: "177, 239, 211", core: "248, 255, 252" } },
};

export function getBarrierEffectPreset(presetId: BattleMoveVfxBarrierPresetId): BarrierEffectPreset {
  return BARRIER_EFFECT_PRESETS[presetId];
}
