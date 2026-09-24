import { getPokemonForm } from "../pokemon-form.registry.js";
import { calculateBattleNonHpStat } from "./pokemon-battle-stat.js";
import { resolveBattleDamageRandomModifier } from "./pokemon-battle-move-damage.js";
import type { BattleMoveExecutionContext } from "./pokemon-battle-move-execution.js";
import { ensureBattlePokemonStatusState } from "./pokemon-battle-status.js";
import { applyBattleStatusAttackModifier } from "./pokemon-battle-status-effects.js";

export type BattleStatusActionRandomSource = () => number;

export type BattleActionBlockingStatus =
  | "sleep"
  | "freeze"
  | "paralysis"
  | "confusion";

export type BattleStatusActionClearedStatus = "sleep" | "freeze" | "confusion";

export type BattleStatusActionEffect =
  | {
      readonly type: "status-cleared";
      readonly status: BattleStatusActionClearedStatus;
    }
  | {
      readonly type: "action-prevented";
      readonly status: Exclude<BattleActionBlockingStatus, "confusion">;
    }
  | {
      readonly type: "confusion-self-damage";
      readonly previousHp: number;
      readonly currentHp: number;
      readonly appliedDamage: number;
    };

export interface BattleStatusActionResolution {
  readonly canExecuteMove: boolean;
  readonly effects: readonly BattleStatusActionEffect[];
}

const FREEZE_SELF_THAW_MOVE_IDS = new Set<number>([
  172, // Flame Wheel
  221, // Sacred Fire
  394, // Flare Blitz
]);

const FREEZE_NATURAL_THAW_CHANCE = 0.2;
const PARALYSIS_FULLY_PARALYZED_CHANCE = 0.25;
const CONFUSION_SELF_HIT_CHANCE = 0.5;
const CONFUSION_SELF_HIT_POWER = 40;

/**
 * Resolves the Generation IV-style status gates that run immediately before a
 * selected move is allowed to execute.
 *
 * Ordering intentionally follows the core move-clearance sequence relevant to
 * Status Conditions V1:
 *   1. Sleep / Freeze
 *   2. Confusion
 *   3. Paralysis
 *
 * PP, accuracy, direct damage and move secondary effects remain outside this
 * function. The caller must consume PP only when canExecuteMove === true.
 */
export function resolveBattleStatusAction(
  context: BattleMoveExecutionContext,
  random: BattleStatusActionRandomSource = Math.random,
): BattleStatusActionResolution {
  const effects: BattleStatusActionEffect[] = [];
  const statusState = ensureBattlePokemonStatusState(context.actorPokemon);

  const major = statusState.major;

  if (major?.type === "sleep") {
    major.turnsRemaining -= 1;

    effects.push({
      type: "action-prevented",
      status: "sleep",
    });

    if (major.turnsRemaining <= 0) {
      statusState.major = null;
      effects.push({ type: "status-cleared", status: "sleep" });
    }

    return {
      canExecuteMove: false,
      effects,
    };
  }

  if (major?.type === "freeze") {
    const thawedBySelectedMove = FREEZE_SELF_THAW_MOVE_IDS.has(context.move.id);
    const thawedNaturally = thawedBySelectedMove
      ? false
      : readBattleStatusActionRandom(random) < FREEZE_NATURAL_THAW_CHANCE;

    if (!thawedBySelectedMove && !thawedNaturally) {
      effects.push({
        type: "action-prevented",
        status: "freeze",
      });

      return {
        canExecuteMove: false,
        effects,
      };
    }

    statusState.major = null;
    effects.push({ type: "status-cleared", status: "freeze" });
  }

  const confusion = statusState.confusion;

  if (confusion !== null) {
    // The final confusion action clears the volatile condition before the move
    // proceeds, so that action cannot self-hit.
    if (confusion.turnsRemaining <= 1) {
      statusState.confusion = null;
      effects.push({ type: "status-cleared", status: "confusion" });
    } else {
      confusion.turnsRemaining -= 1;

      const selfHit =
        readBattleStatusActionRandom(random) < CONFUSION_SELF_HIT_CHANCE;

      if (selfHit) {
        effects.push(applyConfusionSelfDamage(context, random));

        return {
          canExecuteMove: false,
          effects,
        };
      }
    }
  }

  if (statusState.major?.type === "paralysis") {
    const fullyParalyzed =
      readBattleStatusActionRandom(random) < PARALYSIS_FULLY_PARALYZED_CHANCE;

    if (fullyParalyzed) {
      effects.push({
        type: "action-prevented",
        status: "paralysis",
      });

      return {
        canExecuteMove: false,
        effects,
      };
    }
  }

  return {
    canExecuteMove: true,
    effects,
  };
}

function applyConfusionSelfDamage(
  context: BattleMoveExecutionContext,
  random: BattleStatusActionRandomSource,
): Extract<BattleStatusActionEffect, { type: "confusion-self-damage" }> {
  const actorState = context.actorPokemon;
  const pokemon = actorState.pokemon;
  const form = getPokemonForm(pokemon.formId);

  if (!form || form.speciesId !== pokemon.speciesId) {
    throw new Error(
      `Pokémon form "${pokemon.formId}" not found for species "${pokemon.speciesId}" while calculating confusion self-damage`,
    );
  }

  const baseAttack = calculateBattleNonHpStat(form.baseStats.attack, pokemon.level);
  const attack = applyBattleStatusAttackModifier(actorState, baseAttack);
  const defense = calculateBattleNonHpStat(form.baseStats.defense, pokemon.level);

  if (attack <= 0 || defense <= 0) {
    throw new Error(
      `Invalid battle stats while calculating confusion self-damage for Pokémon "${pokemon.instanceId}"`,
    );
  }

  const levelFactor = Math.floor((2 * pokemon.level) / 5) + 2;
  const baseDamage =
    Math.floor(
      Math.floor(
        (levelFactor * CONFUSION_SELF_HIT_POWER * attack) / defense,
      ) / 50,
    ) + 2;

  const randomModifier = resolveBattleDamageRandomModifier(random);
  const requestedDamage = Math.max(1, Math.floor(baseDamage * randomModifier));
  const previousHp = actorState.currentHp;
  const currentHp = Math.max(0, previousHp - requestedDamage);
  const appliedDamage = previousHp - currentHp;

  actorState.currentHp = currentHp;

  return {
    type: "confusion-self-damage",
    previousHp,
    currentHp,
    appliedDamage,
  };
}

function readBattleStatusActionRandom(
  random: BattleStatusActionRandomSource,
): number {
  const roll = random();

  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) {
    throw new Error(
      `Battle status action RNG must return a number in [0, 1), received "${roll}"`,
    );
  }

  return roll;
}
