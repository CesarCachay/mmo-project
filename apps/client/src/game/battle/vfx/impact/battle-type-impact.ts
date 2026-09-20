import { getPokemonMove } from "@cesar-mmo/shared";

import type {
  BattleMoveVfxElement,
  BattleMoveVfxPoint,
} from "../battle-move-vfx.types";
import { getBattleMoveVfxDefinition } from "../move-vfx.registry";

export type BattleTypeImpactStyle =
  | "normal"
  | "fire"
  | "water"
  | "electric"
  | "grass"
  | "ice"
  | "fighting"
  | "poison"
  | "ground"
  | "flying"
  | "psychic"
  | "bug"
  | "rock"
  | "ghost"
  | "dragon"
  | "dark"
  | "steel"
  | "fairy"
  | "shadow";

export interface BattleTypeImpactPalette {
  readonly outer: string;
  readonly mid: string;
  readonly inner: string;
  readonly core: string;
}

export interface BattleTypeImpactProfile {
  readonly element: BattleMoveVfxElement;
  readonly style: BattleTypeImpactStyle;
  readonly palette: BattleTypeImpactPalette;
  readonly durationMs: number;
  readonly radius: number;
  readonly density: number;
  readonly intensity: number;
}

export interface BattleTypeImpactRequest {
  readonly moveId: number;
  readonly target: BattleMoveVfxPoint;
  readonly typeEffectiveness: number;
  readonly hitCount?: number;
}

const PALETTES: Readonly<Record<BattleMoveVfxElement, BattleTypeImpactPalette>> = {
  normal: palette("95, 103, 118", "159, 168, 183", "220, 226, 235", "255, 255, 255"),
  fire: palette("132, 34, 7", "237, 75, 13", "255, 160, 42", "255, 247, 193"),
  water: palette("14, 71, 134", "35, 140, 211", "113, 215, 247", "241, 253, 255"),
  electric: palette("123, 91, 0", "232, 183, 12", "255, 226, 62", "255, 255, 213"),
  grass: palette("25, 89, 37", "55, 161, 72", "132, 221, 105", "239, 255, 213"),
  ice: palette("42, 105, 140", "86, 182, 217", "180, 231, 249", "252, 255, 255"),
  fighting: palette("124, 39, 29", "205, 69, 45", "246, 148, 104", "255, 235, 216"),
  poison: palette("82, 31, 105", "150, 64, 174", "216, 133, 228", "252, 233, 255"),
  ground: palette("104, 72, 34", "166, 119, 58", "222, 181, 108", "255, 239, 188"),
  flying: palette("58, 97, 139", "108, 167, 211", "191, 226, 245", "253, 255, 255"),
  psychic: palette("117, 36, 119", "194, 68, 174", "242, 151, 219", "255, 237, 252"),
  bug: palette("70, 96, 27", "127, 158, 46", "199, 220, 101", "248, 255, 205"),
  rock: palette("88, 72, 54", "148, 120, 84", "211, 179, 122", "249, 230, 188"),
  ghost: palette("55, 31, 93", "103, 62, 156", "176, 122, 216", "241, 214, 255"),
  dragon: palette("54, 49, 140", "93, 87, 211", "176, 165, 243", "246, 240, 255"),
  dark: palette("37, 36, 47", "77, 68, 91", "141, 119, 157", "229, 212, 238"),
  steel: palette("65, 85, 98", "116, 147, 160", "190, 212, 219", "251, 254, 255"),
  fairy: palette("143, 57, 106", "220, 108, 168", "251, 184, 219", "255, 244, 252"),
  shadow: palette("30, 21, 49", "71, 41, 102", "132, 83, 164", "220, 188, 239"),
};

function palette(
  outer: string,
  mid: string,
  inner: string,
  core: string,
): BattleTypeImpactPalette {
  return { outer, mid, inner, core };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function effectivenessIntensity(effectiveness: number): number {
  if (effectiveness >= 4) return 1.28;
  if (effectiveness >= 2) return 1.16;
  if (effectiveness <= 0.25) return 0.7;
  if (effectiveness <= 0.5) return 0.84;
  return 1;
}

function multiHitDensity(hitCount: number | undefined): number {
  if (!hitCount || hitCount <= 1) return 1;
  return 1 + Math.min(0.35, (hitCount - 1) * 0.08);
}

export function resolveBattleTypeImpactProfile(
  request: Omit<BattleTypeImpactRequest, "target">,
): BattleTypeImpactProfile {
  const move = getPokemonMove(request.moveId);
  const definition = getBattleMoveVfxDefinition(request.moveId);
  const element = definition?.element ?? "normal";
  const power = move?.power ?? 50;
  const powerIntensity = clamp(power / 120, 0.45, 1.18);
  const intensity = clamp(
    powerIntensity * effectivenessIntensity(request.typeEffectiveness),
    0.42,
    1.35,
  );
  const density = multiHitDensity(request.hitCount);

  return {
    element,
    style: element,
    palette: PALETTES[element],
    durationMs: Math.round(220 + intensity * 95),
    radius: 28 + intensity * 26,
    density,
    intensity,
  };
}
