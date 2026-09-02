import type { BattlePresentationEvent } from "@cesar-mmo/shared";

export const BATTLE_PRESENTATION_TIMING = {
  moveUsedMessageMs: 650,
  moveMissedMessageMs: 600,
  damageResultMessageMs: 650,
  switchMessageMs: 650,
  faintMessageMs: 700,

  /*
   * Forced replacement does not come from
   * BattlePresentationEvent. It has its own
   * authoritative acknowledgement flow.
   */
  forcedReplacementMessageMs: 650,
} as const;

export function getBattlePresentationMessageDuration(
  event: BattlePresentationEvent
): number {
  switch (event.type) {
    case "move-used":
      return BATTLE_PRESENTATION_TIMING.moveUsedMessageMs;

    case "move-missed":
      return BATTLE_PRESENTATION_TIMING.moveMissedMessageMs;

    case "damage-applied":
      return BATTLE_PRESENTATION_TIMING.damageResultMessageMs;

    case "pokemon-switched":
      return BATTLE_PRESENTATION_TIMING.switchMessageMs;

    case "pokemon-fainted":
      return BATTLE_PRESENTATION_TIMING.faintMessageMs;
  }
}
