import { calculatePokemonNonHpStat } from "../pokemon-stat.js";

export function calculateBattleNonHpStat(
  baseStat: number,
  level: number,
): number {
  return calculatePokemonNonHpStat(baseStat, level);
}
