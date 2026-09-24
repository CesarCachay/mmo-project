import type { BattleMajorStatusCondition } from "./pokemon-battle-status.js";

/**
 * Statuses that a move may inflict in Status Conditions V1.
 *
 * Confusion is intentionally included alongside major statuses for move-effect
 * metadata even though its runtime state remains volatile/separate.
 */
export type BattleMoveStatusCondition =
  | BattleMajorStatusCondition
  | "confusion";

export type BattleStatusMoveTarget = "opponent" | "self";

/**
 * Most secondary effects roll once after a move connects. Twineedle is the
 * notable current exception because its poison chance is evaluated per hit.
 */
export type BattleStatusMoveRollScope = "once-per-move" | "per-hit";

export interface BattleDirectStatusMoveEffect {
  readonly kind: "direct";
  readonly status: BattleMoveStatusCondition;
  readonly target: BattleStatusMoveTarget;
  readonly chancePercent: number;
  readonly rollScope: BattleStatusMoveRollScope;
}

/**
 * Tri Attack-style effect: one successful proc chooses exactly one condition
 * from the declared pool. The engine must NOT roll every condition
 * independently.
 */
export interface BattleRandomStatusMoveEffect {
  readonly kind: "random-one-of";
  readonly statuses: readonly BattleMoveStatusCondition[];
  readonly target: BattleStatusMoveTarget;
  readonly chancePercent: number;
  readonly rollScope: "once-per-move";
}

/**
 * Move-specific mechanics deliberately registered now but deferred from the
 * generic Status Infliction Engine. Keeping them explicit prevents silent
 * omissions while avoiding incorrect partial implementations.
 */
export type BattleDeferredStatusMoveMechanic =
  | "held-item-dependent"
  | "status-transfer"
  | "terrain-dependent"
  | "entry-hazard"
  | "delayed-sleep"
  | "self-rest"
  | "stat-stage-composite"
  | "recording-dependent-confusion"
  | "fatigue-confusion";

export interface BattleDeferredStatusMoveEffect {
  readonly kind: "deferred";
  readonly mechanic: BattleDeferredStatusMoveMechanic;
  readonly statuses: readonly BattleMoveStatusCondition[];
  readonly target: BattleStatusMoveTarget;
  readonly reason: string;
}

export type BattleStatusMoveEffect =
  | BattleDirectStatusMoveEffect
  | BattleRandomStatusMoveEffect
  | BattleDeferredStatusMoveEffect;

export interface BattleStatusMoveDefinition {
  readonly moveId: number;
  readonly effects: readonly BattleStatusMoveEffect[];
}
