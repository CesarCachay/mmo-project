import type { BattleMajorStatusCondition } from "@cesar-mmo/shared";

export interface BattleMajorStatusUiDefinition {
  readonly label: "BRN" | "PSN" | "TOX" | "PAR" | "SLP" | "FRZ";
  readonly title: string;
  readonly className: string;
}

const BATTLE_MAJOR_STATUS_UI: Readonly<
  Record<BattleMajorStatusCondition, BattleMajorStatusUiDefinition>
> = {
  burn: {
    label: "BRN",
    title: "Burned",
    className: "battle-status-badge--burn",
  },
  poison: {
    label: "PSN",
    title: "Poisoned",
    className: "battle-status-badge--poison",
  },
  "badly-poisoned": {
    label: "TOX",
    title: "Badly poisoned",
    className: "battle-status-badge--badly-poisoned",
  },
  paralysis: {
    label: "PAR",
    title: "Paralyzed",
    className: "battle-status-badge--paralysis",
  },
  sleep: {
    label: "SLP",
    title: "Asleep",
    className: "battle-status-badge--sleep",
  },
  freeze: {
    label: "FRZ",
    title: "Frozen",
    className: "battle-status-badge--freeze",
  },
};

export function getBattleMajorStatusUiDefinition(
  status: BattleMajorStatusCondition,
): BattleMajorStatusUiDefinition {
  return BATTLE_MAJOR_STATUS_UI[status];
}
