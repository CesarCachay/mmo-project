import type { BattlePresentationEvent } from "@cesar-mmo/shared";

export const BATTLE_PRESENTATION_TIMING = {
  moveUsedMessageMs: 650,
  moveMissedMessageMs: 600,
  damageResultMessageMs: 650,
  switchMessageMs: 650,
  opponentReplacementLeadInMs: 220,
  faintMessageMs: 700,
  trainerEscapedMessageMs: 650,

  /*
   * Forced replacement does not come from
   * BattlePresentationEvent. It has its own
   * authoritative acknowledgement flow.
   */
  forcedReplacementMessageMs: 650,
  itemUsedMessageMs: 650,
  hpRestoredMessageMs: 500,
  statusMessageMs: 700,
  statusResidualMessageMs: 600,
  captureMessageMs: 1200,
  experienceGainedMessageMs: 700,
  levelUpMessageMs: 900,
  moveLearnedMessageMs: 900,
  moveLearningMessageMs: 900,

  /*
   * Small breathing room after the defeated Pokémon
   * finishes its faint presentation and before Party EXP
   * starts animating.
   */
  experienceRewardLeadInMs: 500,
} as const;

export function getBattlePresentationMessageDuration(
  event: BattlePresentationEvent,
): number {
  switch (event.type) {
    case "move-used":
      return BATTLE_PRESENTATION_TIMING.moveUsedMessageMs;

    case "move-missed":
      return BATTLE_PRESENTATION_TIMING.moveMissedMessageMs;

    case "damage-applied":
      return BATTLE_PRESENTATION_TIMING.damageResultMessageMs;

    case "status-inflicted":
    case "status-cleared":
    case "status-action-prevented":
    case "confusion-self-damage":
      return BATTLE_PRESENTATION_TIMING.statusMessageMs;

    case "status-residual-damage":
      return BATTLE_PRESENTATION_TIMING.statusResidualMessageMs;

    case "pokemon-switched":
      return BATTLE_PRESENTATION_TIMING.switchMessageMs;

    case "pokemon-fainted":
      return BATTLE_PRESENTATION_TIMING.faintMessageMs;

    case "run-failed":
    case "run-succeeded":
      return BATTLE_PRESENTATION_TIMING.trainerEscapedMessageMs;

    case "item-used":
      return BATTLE_PRESENTATION_TIMING.itemUsedMessageMs;

    case "hp-restored":
      return BATTLE_PRESENTATION_TIMING.hpRestoredMessageMs;

    case "capture-failed":
    case "capture-succeeded":
      return BATTLE_PRESENTATION_TIMING.captureMessageMs;

    case "experience-gained":
      return BATTLE_PRESENTATION_TIMING.experienceGainedMessageMs;

    case "pokemon-leveled-up":
      return BATTLE_PRESENTATION_TIMING.levelUpMessageMs;

    case "move-learned":
      return BATTLE_PRESENTATION_TIMING.moveLearnedMessageMs;

    case "move-learning-required":
      return BATTLE_PRESENTATION_TIMING.moveLearningMessageMs;

    case "evolution-required": {
      return 0;
    }
  }
}
