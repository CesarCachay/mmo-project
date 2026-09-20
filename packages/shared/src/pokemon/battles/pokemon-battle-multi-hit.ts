export type BattleMultiHitRandomSource = () => number;

export interface BattleMoveMultiHitRule {
  readonly moveId: number;
  readonly mode: "fixed" | "two-to-five";
  readonly fixedHits?: number;
}

/*
 * Standard multi-hit moves available in the current Gen I-IV move registry.
 * Special mechanics such as Triple Kick and Beat Up intentionally stay out of
 * this table until their move-specific damage rules are implemented.
 */
const BATTLE_MOVE_MULTI_HIT_RULES: Readonly<Record<number, BattleMoveMultiHitRule>> = {
  3: { moveId: 3, mode: "two-to-five" }, // Double Slap
  4: { moveId: 4, mode: "two-to-five" }, // Comet Punch
  24: { moveId: 24, mode: "fixed", fixedHits: 2 }, // Double Kick
  31: { moveId: 31, mode: "two-to-five" }, // Fury Attack
  41: { moveId: 41, mode: "fixed", fixedHits: 2 }, // Twineedle
  42: { moveId: 42, mode: "two-to-five" }, // Pin Missile
  131: { moveId: 131, mode: "two-to-five" }, // Spike Cannon
  140: { moveId: 140, mode: "two-to-five" }, // Barrage
  154: { moveId: 154, mode: "two-to-five" }, // Fury Swipes
  155: { moveId: 155, mode: "fixed", fixedHits: 2 }, // Bonemerang
  198: { moveId: 198, mode: "two-to-five" }, // Bone Rush
  292: { moveId: 292, mode: "two-to-five" }, // Arm Thrust
  331: { moveId: 331, mode: "two-to-five" }, // Bullet Seed
  333: { moveId: 333, mode: "two-to-five" }, // Icicle Spear
  350: { moveId: 350, mode: "two-to-five" }, // Rock Blast
  458: { moveId: 458, mode: "fixed", fixedHits: 2 }, // Double Hit
};

export function getBattleMoveMultiHitRule(
  moveId: number,
): BattleMoveMultiHitRule | undefined {
  return BATTLE_MOVE_MULTI_HIT_RULES[moveId];
}

export function resolveBattleMoveHitCount(
  moveId: number,
  random: BattleMultiHitRandomSource = Math.random,
): number {
  const rule = getBattleMoveMultiHitRule(moveId);

  if (!rule) {
    return 1;
  }

  if (rule.mode === "fixed") {
    const fixedHits = rule.fixedHits;

    if (!Number.isInteger(fixedHits) || (fixedHits ?? 0) <= 1) {
      throw new Error(`Invalid fixed multi-hit count for move "${moveId}"`);
    }

    return fixedHits as number;
  }

  const roll = random();

  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) {
    throw new Error(
      `Battle multi-hit RNG must return a number in [0, 1), received "${roll}"`,
    );
  }

  // Gen I-IV style 2-5 hit distribution: 3/8, 3/8, 1/8, 1/8.
  if (roll < 3 / 8) {
    return 2;
  }

  if (roll < 6 / 8) {
    return 3;
  }

  if (roll < 7 / 8) {
    return 4;
  }

  return 5;
}
