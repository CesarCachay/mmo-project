import type {
  PokemonBattleCompletedPayload,
  PokemonBattlePresentationContext,
} from "@cesar-mmo/shared";

export type BattleOutcomeAudioProfile =
  | "standard-victory"
  | "gym-leader-victory"
  | "defeat"
  | "none";

/**
 * Presentation-only routing. Battle rules/outcomes remain fully authoritative.
 */
export function resolveBattleOutcomeAudioProfile(
  outcome: PokemonBattleCompletedPayload["outcome"],
  presentation?: PokemonBattlePresentationContext,
): BattleOutcomeAudioProfile {
  switch (outcome) {
    case "wild-defeated":
      return "standard-victory";

    case "trainer-battle-victory":
      return presentation?.kind === "gym-leader"
        ? "gym-leader-victory"
        : "standard-victory";

    case "trainer-defeated":
    case "trainer-battle-defeat":
      return "defeat";

    default:
      return "none";
  }
}
