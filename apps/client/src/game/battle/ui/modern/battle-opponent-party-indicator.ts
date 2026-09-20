import type { BattleInstance } from "@cesar-mmo/shared";

export type BattleOpponentPartySlotState = "available" | "defeated";

export interface BattleOpponentPartyIndicatorModel {
  readonly displayName: string;
  readonly totalPokemon: number;
  readonly usablePokemon: number;
  readonly slots: readonly BattleOpponentPartySlotState[];
}

export function getBattleOpponentPartyIndicatorModel(
  battle: BattleInstance,
  localParticipantId: string,
): BattleOpponentPartyIndicatorModel | undefined {
  if (battle.type !== "trainer") {
    return undefined;
  }

  const opponent = battle.participants.find(
    (participant) => participant.id !== localParticipantId,
  );

  if (!opponent || opponent.type !== "trainer" || opponent.pokemon.length === 0) {
    return undefined;
  }

  const slots = opponent.pokemon.map((pokemon) =>
    pokemon.currentHp > 0 ? "available" : "defeated",
  ) satisfies BattleOpponentPartySlotState[];

  return {
    displayName: opponent.displayName?.trim() || "Trainer",
    totalPokemon: slots.length,
    usablePokemon: slots.filter((slot) => slot === "available").length,
    slots,
  };
}
