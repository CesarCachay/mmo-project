import { getPokemonMove } from "@cesar-mmo/shared";

import { getBattleMoveVfxDefinition } from "../move-vfx.registry";

export interface BattleImpactFeedbackRequest {
  readonly moveId: number;
  readonly typeEffectiveness: number;
  readonly hitCount?: number;
}

export interface BattleImpactFeedbackProfile {
  readonly hitStopMs: number;
  readonly shakeDurationMs: number;
  readonly shakeAmplitudePx: number;
  readonly shakeFrequency: number;
}

interface BattleImpactFeedbackOverride {
  readonly hitStopMs?: number;
  readonly shakeDurationMs?: number;
  readonly shakeAmplitudePx?: number;
  readonly shakeFrequency?: number;
}

const IMPACT_OVERRIDES: ReadonlyMap<number, BattleImpactFeedbackOverride> = new Map([
  // Body Slam
  [34, { hitStopMs: 38, shakeDurationMs: 190, shakeAmplitudePx: 7.5 }],
  // Take Down
  [36, { hitStopMs: 42, shakeDurationMs: 215, shakeAmplitudePx: 8.5 }],
  // Hydro Pump
  [56, { hitStopMs: 42, shakeDurationMs: 210, shakeAmplitudePx: 8 }],
  // Hyper Beam
  [63, { hitStopMs: 58, shakeDurationMs: 270, shakeAmplitudePx: 11.5, shakeFrequency: 1.15 }],
  // Solar Beam
  [76, { hitStopMs: 50, shakeDurationMs: 235, shakeAmplitudePx: 9.5 }],
  // Earthquake
  [89, { hitStopMs: 48, shakeDurationMs: 320, shakeAmplitudePx: 10.5, shakeFrequency: 0.82 }],
  // Self-Destruct
  [120, { hitStopMs: 62, shakeDurationMs: 310, shakeAmplitudePx: 12 }],
  // Fire Blast
  [126, { hitStopMs: 46, shakeDurationMs: 225, shakeAmplitudePx: 8.5 }],
  // Explosion
  [153, { hitStopMs: 70, shakeDurationMs: 350, shakeAmplitudePx: 13.5, shakeFrequency: 0.92 }],
  // Rock Slide
  [157, { hitStopMs: 43, shakeDurationMs: 245, shakeAmplitudePx: 8.5 }],
]);

const ARCHETYPE_MULTIPLIER: Readonly<Record<string, number>> = {
  stream: 0.95,
  projectile: 0.9,
  beam: 1.08,
  contact: 1.08,
  melee: 1.02,
  "multi-projectile": 0.9,
  burst: 1.18,
  ground: 1.16,
  wave: 1,
  aoe: 1.08,
  support: 0,
  status: 0,
  barrier: 0,
  tether: 0.85,
  battlefield: 0,
  generic: 0.92,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getEffectivenessMultiplier(typeEffectiveness: number): number {
  if (typeEffectiveness >= 4) return 1.24;
  if (typeEffectiveness >= 2) return 1.12;
  if (typeEffectiveness <= 0.25) return 0.68;
  if (typeEffectiveness <= 0.5) return 0.82;
  return 1;
}

function getMultiHitMultiplier(hitCount: number | undefined): number {
  if (!hitCount || hitCount <= 1) return 1;
  return 1 + Math.min(0.2, (hitCount - 1) * 0.045);
}

export function resolveBattleImpactFeedbackProfile(
  request: BattleImpactFeedbackRequest,
): BattleImpactFeedbackProfile {
  const move = getPokemonMove(request.moveId);
  const vfx = getBattleMoveVfxDefinition(request.moveId);

  const power = move?.power ?? 50;
  const powerRatio = clamp(power / 150, 0.18, 1);
  const archetypeMultiplier = vfx
    ? ARCHETYPE_MULTIPLIER[vfx.archetype] ?? 1
    : 1;
  const effectivenessMultiplier = getEffectivenessMultiplier(
    request.typeEffectiveness,
  );
  const multiHitMultiplier = getMultiHitMultiplier(request.hitCount);

  const intensity = clamp(
    powerRatio * archetypeMultiplier * effectivenessMultiplier * multiHitMultiplier,
    0.16,
    1.35,
  );

  const base: BattleImpactFeedbackProfile = {
    hitStopMs: Math.round(16 + intensity * 34),
    shakeDurationMs: Math.round(80 + intensity * 155),
    shakeAmplitudePx: 2 + intensity * 7,
    shakeFrequency: 1,
  };

  const override = IMPACT_OVERRIDES.get(request.moveId);

  if (!override) {
    return base;
  }

  return {
    hitStopMs: override.hitStopMs ?? base.hitStopMs,
    shakeDurationMs: override.shakeDurationMs ?? base.shakeDurationMs,
    shakeAmplitudePx: override.shakeAmplitudePx ?? base.shakeAmplitudePx,
    shakeFrequency: override.shakeFrequency ?? base.shakeFrequency,
  };
}
