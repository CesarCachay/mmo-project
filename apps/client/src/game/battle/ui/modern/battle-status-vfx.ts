import type { BattleMajorStatusCondition } from "@cesar-mmo/shared";

export type BattleStatusVfxId = BattleMajorStatusCondition | "confusion";

export type BattleStatusVfxBurstKind =
  | "inflict"
  | "clear"
  | "blocked"
  | "residual"
  | "self-hit";

export interface BattleStatusVfxDefinition {
  readonly id: BattleStatusVfxId;
  readonly className: string;
  readonly ariaLabel: string;
  readonly particleCount: number;
}

export interface BattleStatusVfxBurstDefinition {
  readonly kind: BattleStatusVfxBurstKind;
  readonly className: string;
  readonly durationMs: number;
  readonly particleCount: number;
}

const STATUS_VFX_DEFINITIONS: Readonly<Record<BattleStatusVfxId, BattleStatusVfxDefinition>> = {
  burn: {
    id: "burn",
    className: "battle-status-vfx__effect--burn",
    ariaLabel: "Burn visual effect",
    particleCount: 7,
  },
  poison: {
    id: "poison",
    className: "battle-status-vfx__effect--poison",
    ariaLabel: "Poison visual effect",
    particleCount: 8,
  },
  "badly-poisoned": {
    id: "badly-poisoned",
    className: "battle-status-vfx__effect--badly-poisoned",
    ariaLabel: "Bad poison visual effect",
    particleCount: 10,
  },
  paralysis: {
    id: "paralysis",
    className: "battle-status-vfx__effect--paralysis",
    ariaLabel: "Paralysis visual effect",
    particleCount: 7,
  },
  sleep: {
    id: "sleep",
    className: "battle-status-vfx__effect--sleep",
    ariaLabel: "Sleep visual effect",
    particleCount: 6,
  },
  freeze: {
    id: "freeze",
    className: "battle-status-vfx__effect--freeze",
    ariaLabel: "Freeze visual effect",
    particleCount: 7,
  },
  confusion: {
    id: "confusion",
    className: "battle-status-vfx__effect--confusion",
    ariaLabel: "Confusion visual effect",
    particleCount: 4,
  },
};

const STATUS_VFX_BURST_DEFINITIONS: Readonly<
  Record<BattleStatusVfxBurstKind, BattleStatusVfxBurstDefinition>
> = {
  inflict: {
    kind: "inflict",
    className: "battle-status-vfx__burst--inflict",
    durationMs: 420,
    particleCount: 8,
  },
  clear: {
    kind: "clear",
    className: "battle-status-vfx__burst--clear",
    durationMs: 360,
    particleCount: 7,
  },
  blocked: {
    kind: "blocked",
    className: "battle-status-vfx__burst--blocked",
    durationMs: 380,
    particleCount: 6,
  },
  residual: {
    kind: "residual",
    className: "battle-status-vfx__burst--residual",
    durationMs: 440,
    particleCount: 7,
  },
  "self-hit": {
    kind: "self-hit",
    className: "battle-status-vfx__burst--self-hit",
    durationMs: 400,
    particleCount: 7,
  },
};

export function getBattleStatusVfxDefinition(
  status: BattleStatusVfxId,
): BattleStatusVfxDefinition {
  return STATUS_VFX_DEFINITIONS[status];
}

export function getBattleStatusVfxBurstDefinition(
  kind: BattleStatusVfxBurstKind,
): BattleStatusVfxBurstDefinition {
  return STATUS_VFX_BURST_DEFINITIONS[kind];
}

export function getBattleStatusVfxIds(): readonly BattleStatusVfxId[] {
  return Object.keys(STATUS_VFX_DEFINITIONS) as BattleStatusVfxId[];
}
