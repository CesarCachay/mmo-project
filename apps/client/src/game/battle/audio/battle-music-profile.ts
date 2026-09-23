import type {
  BattleType,
  PokemonBattlePresentationContext,
} from "@cesar-mmo/shared";

export type BattleMusicProfile = "wild" | "trainer" | "gym-leader";

/**
 * Presentation routing only. It never changes BattleType or battle rules.
 */
export function resolveBattleMusicProfile(
  battleType: BattleType,
  presentation?: PokemonBattlePresentationContext,
): BattleMusicProfile {
  if (presentation?.kind === "gym-leader") {
    return "gym-leader";
  }

  return battleType;
}
