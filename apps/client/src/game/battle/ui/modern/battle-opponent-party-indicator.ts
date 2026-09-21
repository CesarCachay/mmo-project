import type { BattleInstance } from "@cesar-mmo/shared";

export type BattleOpponentPartySlotState = "available" | "defeated";

export type BattlePartyIndicatorPerspective = "opponent" | "player";

export interface BattleOpponentPartyIndicatorModel {
  readonly displayName: string;
  readonly totalPokemon: number;
  readonly usablePokemon: number;
  readonly slots: readonly BattleOpponentPartySlotState[];
}

export function getBattlePartyIndicatorModel(
  battle: BattleInstance,
  localParticipantId: string,
  perspective: BattlePartyIndicatorPerspective,
): BattleOpponentPartyIndicatorModel | undefined {
  if (battle.type !== "trainer") {
    return undefined;
  }

  const participant = battle.participants.find((candidate) =>
    perspective === "player"
      ? candidate.id === localParticipantId
      : candidate.id !== localParticipantId,
  );

  if (
    !participant ||
    participant.type !== "trainer" ||
    participant.pokemon.length === 0
  ) {
    return undefined;
  }

  const slots = participant.pokemon.map((pokemon) =>
    pokemon.currentHp > 0 ? "available" : "defeated",
  ) satisfies BattleOpponentPartySlotState[];

  return {
    displayName:
      perspective === "player"
        ? participant.displayName?.trim() || "You"
        : participant.displayName?.trim() || "Trainer",
    totalPokemon: slots.length,
    usablePokemon: slots.filter((slot) => slot === "available").length,
    slots,
  };
}

export function getBattleOpponentPartyIndicatorModel(
  battle: BattleInstance,
  localParticipantId: string,
): BattleOpponentPartyIndicatorModel | undefined {
  return getBattlePartyIndicatorModel(battle, localParticipantId, "opponent");
}

export function getBattlePlayerPartyIndicatorModel(
  battle: BattleInstance,
  localParticipantId: string,
): BattleOpponentPartyIndicatorModel | undefined {
  return getBattlePartyIndicatorModel(battle, localParticipantId, "player");
}
