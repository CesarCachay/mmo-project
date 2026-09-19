import type { BattleType } from "@cesar-mmo/shared";

export interface BattleIntroCopy {
  readonly eyebrow: string;
  readonly title: string;
  readonly subtitle: string;
}

export function getBattleIntroCopy(
  type: BattleType,
  opponentName?: string,
): BattleIntroCopy {
  const safeOpponentName = opponentName?.trim();

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
