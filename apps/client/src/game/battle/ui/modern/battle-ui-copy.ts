import type {
  BattleType,
  PokemonBattlePresentationContext,
} from "@cesar-mmo/shared";

export interface BattleIntroCopy {
  readonly eyebrow: string;
  readonly title: string;
  readonly subtitle: string;
}

export function getBattleIntroCopy(
  type: BattleType,
  opponentName?: string,
  presentation?: PokemonBattlePresentationContext,
): BattleIntroCopy {
  const safeOpponentName = opponentName?.trim();

  if (presentation?.kind === "gym-leader") {
    return {
      eyebrow: "GYM LEADER BATTLE",
      title: safeOpponentName
        ? `VS ${safeOpponentName.toUpperCase()}`
        : "VS GYM LEADER",
      subtitle: safeOpponentName
        ? `${presentation.trainerClass} ${safeOpponentName} challenges you!`
        : "A Gym Leader challenges you!",
    };
  }

  if (type === "trainer") {
    return {
      eyebrow: "TRAINER BATTLE",
      title: safeOpponentName ? `VS ${safeOpponentName.toUpperCase()}` : "VS TRAINER",
      subtitle: safeOpponentName
        ? `${safeOpponentName} challenges you!`
        : "A Trainer challenges you!",
    };
  }

  return {
    eyebrow: "WILD ENCOUNTER",
    title: safeOpponentName ? safeOpponentName.toUpperCase() : "A WILD POKÉMON",
    subtitle: "A wild Pokémon appeared!",
  };
}
