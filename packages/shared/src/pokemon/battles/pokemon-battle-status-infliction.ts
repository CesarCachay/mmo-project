import { getPokemonForm } from "../pokemon-form.registry.js";
import { getCombinedTypeEffectiveness } from "../pokemon-type.registry.js";
import type { PokemonType } from "../pokemon.types.js";
import type { BattleMoveExecutionContext } from "./pokemon-battle-move-execution.js";
import { getBattleExecutableStatusMoveEffects } from "./pokemon-battle-status-move.registry.js";
import type {
  BattleDirectStatusMoveEffect,
  BattleMoveStatusCondition,
  BattleRandomStatusMoveEffect,
  BattleStatusMoveTarget,
} from "./pokemon-battle-status-move.types.js";
import {
  ensureBattlePokemonStatusState,
  type BattlePokemonMajorStatusState,
} from "./pokemon-battle-status.js";
import type {
  BattleParticipantId,
  BattlePokemonState,
} from "./pokemon-battle.types.js";

export type BattleStatusInflictionRandomSource = () => number;

export type BattleStatusInflictionBlockedReason =
  | "chance-failed"
  | "target-fainted"
  | "major-status-present"
  | "confusion-present"
  | "type-immunity"
  | "move-type-immunity";

export interface BattleStatusInflictionAppliedResult {
  readonly type: "applied";
  readonly status: BattleMoveStatusCondition;
  readonly targetParticipantId: BattleParticipantId;
  readonly targetPokemonInstanceId: string;
}

export interface BattleStatusInflictionBlockedResult {
  readonly type: "blocked";
  readonly status: BattleMoveStatusCondition;
  readonly targetParticipantId: BattleParticipantId;
  readonly targetPokemonInstanceId: string;
  readonly reason: BattleStatusInflictionBlockedReason;
}

export type BattleStatusInflictionResult =
  | BattleStatusInflictionAppliedResult
  | BattleStatusInflictionBlockedResult;

export interface ApplyBattleMoveStatusEffectsInput {
  readonly context: BattleMoveExecutionContext;
  /**
   * Authoritative number of successful hits for the move. Per-hit effects
   * (currently Twineedle) roll once for each successful hit.
   */
  readonly successfulHitCount?: number;
  readonly random?: BattleStatusInflictionRandomSource;
}

const SLEEP_MIN_TURNS = 1;
const SLEEP_MAX_TURNS = 4;
const CONFUSION_MIN_TURNS = 2;
const CONFUSION_MAX_TURNS = 5;

/**
 * Applies executable move-driven status effects to Battle runtime state.
 *
 * This function is intentionally pure with respect to networking/presentation:
 * it mutates only the authoritative BattlePokemonState supplied by the Battle
 * execution context and returns structured results for the server to present.
 *
 * It does NOT implement action denial, residual damage, stat penalties,
 * curing, persistence outside Battle, abilities, held items or deferred
 * composite moves. Those belong to later Status Conditions V1 steps.
 */
export function applyBattleMoveStatusEffects(
  input: ApplyBattleMoveStatusEffectsInput,
): readonly BattleStatusInflictionResult[] {
  const { context } = input;
  const random = input.random ?? Math.random;
  const successfulHitCount = input.successfulHitCount ?? 1;

  if (!Number.isInteger(successfulHitCount) || successfulHitCount < 0) {
    throw new Error(
      `Battle status successfulHitCount must be a non-negative integer, received "${successfulHitCount}"`,
    );
  }

  const effects = getBattleExecutableStatusMoveEffects(context.move.id);

  if (effects.length === 0 || successfulHitCount === 0) {
    return [];
  }

  const results: BattleStatusInflictionResult[] = [];

  for (const effect of effects) {
    if (effect.kind === "direct") {
      const attempts = effect.rollScope === "per-hit" ? successfulHitCount : 1;

      for (let attemptIndex = 0; attemptIndex < attempts; attemptIndex += 1) {
        const result = applyDirectStatusEffect(context, effect, random);
        results.push(result);

        // Once a per-hit status succeeds, later hits cannot meaningfully
        // reapply the same condition and should not consume additional RNG.
        if (result.type === "applied") {
          break;
        }
      }

      continue;
    }

    const result = applyRandomStatusEffect(context, effect, random);
    results.push(result);
  }

  return results;
}

function applyDirectStatusEffect(
  context: BattleMoveExecutionContext,
  effect: BattleDirectStatusMoveEffect,
  random: BattleStatusInflictionRandomSource,
): BattleStatusInflictionResult {
  const target = resolveStatusTarget(context, effect.target);

  if (!rollStatusChance(effect.chancePercent, random)) {
    return blockedResult(effect.status, target, "chance-failed");
  }

  return attemptApplyStatus(context, effect.status, target, random);
}

function applyRandomStatusEffect(
  context: BattleMoveExecutionContext,
  effect: BattleRandomStatusMoveEffect,
  random: BattleStatusInflictionRandomSource,
): BattleStatusInflictionResult {
  const target = resolveStatusTarget(context, effect.target);

  if (!rollStatusChance(effect.chancePercent, random)) {
    // The proc failed before a concrete condition was chosen. We expose the
    // first declared status only as a deterministic diagnostic placeholder;
    // blocked results are server-internal and are never presented to clients.
    return blockedResult(effect.statuses[0]!, target, "chance-failed");
  }

  const status = chooseRandomStatus(effect.statuses, random);
  return attemptApplyStatus(context, status, target, random);
}

interface ResolvedStatusTarget {
  readonly participantId: BattleParticipantId;
  readonly pokemon: BattlePokemonState;
}

function resolveStatusTarget(
  context: BattleMoveExecutionContext,
  target: BattleStatusMoveTarget,
): ResolvedStatusTarget {
  if (target === "self") {
    return {
      participantId: context.actorParticipantId,
      pokemon: context.actorPokemon,
    };
  }

  return {
    participantId: context.targetParticipantId,
    pokemon: context.targetPokemon,
  };
}

function attemptApplyStatus(
  context: BattleMoveExecutionContext,
  status: BattleMoveStatusCondition,
  target: ResolvedStatusTarget,
  random: BattleStatusInflictionRandomSource,
): BattleStatusInflictionResult {
  if (target.pokemon.currentHp <= 0) {
    return blockedResult(status, target, "target-fainted");
  }

  if (isMoveTypeImmuneToStatusEffect(context, target)) {
    return blockedResult(status, target, "move-type-immunity");
  }

  if (isPokemonTypeImmuneToStatus(status, target.pokemon)) {
    return blockedResult(status, target, "type-immunity");
  }

  const state = ensureBattlePokemonStatusState(target.pokemon);

  if (status === "confusion") {
    if (state.confusion !== null) {
      return blockedResult(status, target, "confusion-present");
    }

    state.confusion = {
      turnsRemaining: resolveInclusiveTurnCount(
        CONFUSION_MIN_TURNS,
        CONFUSION_MAX_TURNS,
        random,
      ),
    };

    return appliedResult(status, target);
  }

  if (state.major !== null) {
    return blockedResult(status, target, "major-status-present");
  }

  state.major = createMajorStatusState(status, random);
  return appliedResult(status, target);
}

function createMajorStatusState(
  status: Exclude<BattleMoveStatusCondition, "confusion">,
  random: BattleStatusInflictionRandomSource,
): BattlePokemonMajorStatusState {
  switch (status) {
    case "badly-poisoned":
      return {
        type: "badly-poisoned",
        toxicCounter: 1,
      };

    case "sleep":
      return {
        type: "sleep",
        turnsRemaining: resolveInclusiveTurnCount(
          SLEEP_MIN_TURNS,
          SLEEP_MAX_TURNS,
          random,
        ),
      };

    case "burn":
    case "poison":
    case "paralysis":
    case "freeze":
      return { type: status };
  }
}

function isPokemonTypeImmuneToStatus(
  status: BattleMoveStatusCondition,
  pokemon: BattlePokemonState,
): boolean {
  const types = getBattlePokemonTypes(pokemon);

  switch (status) {
    case "burn":
      return types.includes("fire");

    case "poison":
    case "badly-poisoned":
      return types.includes("poison") || types.includes("steel");

    case "freeze":
      return types.includes("ice");

    // César MMO currently follows its Gen I-IV/Sinnoh data baseline for
    // Status V1. Electric types are therefore NOT intrinsically immune to
    // paralysis here. Ground immunity to Thunder Wave is handled separately
    // as a move-type immunity below.
    case "paralysis":
    case "sleep":
    case "confusion":
      return false;
  }
}

function isMoveTypeImmuneToStatusEffect(
  context: BattleMoveExecutionContext,
  target: ResolvedStatusTarget,
): boolean {
  const targetTypes = getBattlePokemonTypes(target.pokemon);

  // A damaging move that is completely type-immune cannot deliver its
  // secondary status effect (for example Thunder Punch into Ground).
  if (
    context.move.damageClass !== "status" &&
    context.move.power !== null &&
    getCombinedTypeEffectiveness(context.move.type, targetTypes) === 0
  ) {
    return true;
  }

  // Thunder Wave is the current Gen I-IV status-move exception in the
  // registry whose effect is blocked by the Electric -> Ground immunity.
  if (
    context.move.id === 86 &&
    getCombinedTypeEffectiveness("electric", targetTypes) === 0
  ) {
    return true;
  }

  return false;
}

function getBattlePokemonTypes(pokemon: BattlePokemonState): PokemonType[] {
  const form = getPokemonForm(pokemon.pokemon.formId);

  if (!form || form.speciesId !== pokemon.pokemon.speciesId) {
    throw new Error(
      `Pokémon form "${pokemon.pokemon.formId}" not found for species "${pokemon.pokemon.speciesId}" while applying battle status`,
    );
  }

  return form.types;
}

function chooseRandomStatus(
  statuses: readonly BattleMoveStatusCondition[],
  random: BattleStatusInflictionRandomSource,
): BattleMoveStatusCondition {
  if (statuses.length === 0) {
    throw new Error("Random battle status effect must contain at least one status");
  }

  const roll = readBattleStatusRandom(random);
  const index = Math.floor(roll * statuses.length);
  return statuses[index]!;
}

function rollStatusChance(
  chancePercent: number,
  random: BattleStatusInflictionRandomSource,
): boolean {
  if (
    !Number.isFinite(chancePercent) ||
    chancePercent <= 0 ||
    chancePercent > 100
  ) {
    throw new Error(
      `Invalid battle status chancePercent "${chancePercent}"`,
    );
  }

  if (chancePercent === 100) {
    return true;
  }

  return readBattleStatusRandom(random) < chancePercent / 100;
}

function resolveInclusiveTurnCount(
  min: number,
  max: number,
  random: BattleStatusInflictionRandomSource,
): number {
  const roll = readBattleStatusRandom(random);
  return min + Math.floor(roll * (max - min + 1));
}

function readBattleStatusRandom(
  random: BattleStatusInflictionRandomSource,
): number {
  const roll = random();

  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) {
    throw new Error(
      `Battle status RNG must return a number in [0, 1), received "${roll}"`,
    );
  }

  return roll;
}

function appliedResult(
  status: BattleMoveStatusCondition,
  target: ResolvedStatusTarget,
): BattleStatusInflictionAppliedResult {
  return {
    type: "applied",
    status,
    targetParticipantId: target.participantId,
    targetPokemonInstanceId: target.pokemon.pokemon.instanceId,
  };
}

function blockedResult(
  status: BattleMoveStatusCondition,
  target: ResolvedStatusTarget,
  reason: BattleStatusInflictionBlockedReason,
): BattleStatusInflictionBlockedResult {
  return {
    type: "blocked",
    status,
    targetParticipantId: target.participantId,
    targetPokemonInstanceId: target.pokemon.pokemon.instanceId,
    reason,
  };
}
