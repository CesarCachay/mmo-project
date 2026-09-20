import type { BattleMoveVfxAoePresetId } from "../../battle-move-vfx.types";

export type AoeEffectKind = "falling-rocks" | "vortex" | "mud-splash";

export interface AoeEffectPreset {
  readonly kind: AoeEffectKind;
  readonly chargeEnd: number;
  readonly actionEnd: number;
  readonly radius: number;
  readonly itemCount: number;
  readonly ringCount: number;
  readonly impactCount: number;
  readonly palette: {
    readonly outer: string;
    readonly mid: string;
    readonly inner: string;
    readonly core: string;
    readonly particle: string;
  };
}

const AOE_EFFECT_PRESETS: Record<BattleMoveVfxAoePresetId, AoeEffectPreset> = {
  "rock-slide": {
    kind: "falling-rocks",
    chargeEnd: 0.08,
    actionEnd: 0.88,
    radius: 82,
    itemCount: 9,
    ringCount: 2,
    impactCount: 7,
    palette: {
      outer: "83, 68, 57",
      mid: "126, 101, 79",
      inner: "175, 145, 104",
      core: "235, 211, 167",
      particle: "145, 116, 86",
    },
  },
  twister: {
    kind: "vortex",
    chargeEnd: 0.10,
    actionEnd: 0.92,
    radius: 74,
    itemCount: 22,
    ringCount: 6,
    impactCount: 10,
    palette: {
      outer: "68, 71, 126",
      mid: "105, 104, 184",
      inner: "162, 154, 229",
      core: "238, 232, 255",
      particle: "185, 174, 246",
    },
  },
  "muddy-water": {
    kind: "mud-splash",
    chargeEnd: 0.08,
    actionEnd: 0.90,
    radius: 92,
    itemCount: 24,
    ringCount: 3,
    impactCount: 9,
    palette: {
      outer: "75, 66, 45",
      mid: "116, 100, 62",
      inner: "159, 142, 87",
      core: "226, 219, 166",
      particle: "129, 111, 70",
    },
  },
};

export function getAoeEffectPreset(presetId: BattleMoveVfxAoePresetId): AoeEffectPreset {
  return AOE_EFFECT_PRESETS[presetId];
}
