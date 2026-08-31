export function calculateBattleNonHpStat(baseStat: number, level: number): number {
  if (!Number.isInteger(baseStat) || baseStat <= 0) {
    throw new Error(`Invalid Pokémon base stat "${baseStat}"`);
  }

  if (!Number.isInteger(level) || level <= 0) {
    throw new Error(`Invalid Pokémon level "${level}" while calculating battle stat`);
  }

  //
  // Battle V1.
  //
  // No IV / EV / Nature yet.
  //
  // Same simplified model already used
  // by our Battle Speed foundation.
  //

  return Math.floor((2 * baseStat * level) / 100) + 5;
}
