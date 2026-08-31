import { getPokemonForm } from "../pokemon-form.registry.js";
import { getCombinedTypeEffectiveness } from "../pokemon-type.registry.js";
import { calculateBattleNonHpStat } from "./pokemon-battle-stat.js";
import type { PokemonForm } from "../pokemon.types.js";
import type { BattleMoveExecutionContext } from "./pokemon-battle-move-execution.js";

export type BattleMoveDamageRandomSource = () => number;

export interface BattleMoveDamageResult {
  readonly damage: number;
  readonly baseDamage: number;
  readonly power: number | null;
  readonly attack: number | null;
  readonly defense: number | null;
  readonly damageClass: "physical" | "special" | "status";
  readonly stabMultiplier: number;
  readonly typeEffectiveness: number;
  readonly randomModifier: number;
}

export function calculateBattleMoveDamage(
  context: BattleMoveExecutionContext,

  random: BattleMoveDamageRandomSource = Math.random
): BattleMoveDamageResult {
  const move = context.move;

  // Status moves do not deal direct damage in Battle V1.
  if (move.damageClass === "status") {
    return {
      damage: 0,
      baseDamage: 0,
      power: move.power,
      attack: null,
      defense: null,
      damageClass: move.damageClass,
      stabMultiplier: 1,
      typeEffectiveness: 1,
      randomModifier: 1,
    };
  }

  // Moves without power currently
  // deal zero direct damage Fixed-damage mechanics come later.

  if (move.power === null) {
    return {
      damage: 0,
      baseDamage: 0,
      power: null,
      attack: null,
      defense: null,
      damageClass: move.damageClass,
      stabMultiplier: 1,
      typeEffectiveness: 1,
      randomModifier: 1,
    };
  }

  if (!Number.isInteger(move.power) || move.power <= 0) {
    throw new Error(`Invalid move power "${move.power}" for move "${move.id}"`);
  }

  const actorPokemon = context.actorPokemon.pokemon;
  const targetPokemon = context.targetPokemon.pokemon;

  // Resolve exact forms. Important because types and baseStats can vary by form.

  const actorForm = getBattlePokemonForm(actorPokemon.speciesId, actorPokemon.formId);
  const targetForm = getBattlePokemonForm(targetPokemon.speciesId, targetPokemon.formId);

  let actorBaseStat: number;
  let targetBaseStat: number;

  switch (move.damageClass) {
    case "physical": {
      actorBaseStat = actorForm.baseStats.attack;
      targetBaseStat = targetForm.baseStats.defense;
      break;
    }

    case "special": {
      actorBaseStat = actorForm.baseStats.specialAttack;
      targetBaseStat = targetForm.baseStats.specialDefense;
      break;
    }

    default: {
      throw new Error(`Unsupported move damage class "${move.damageClass}"`);
    }
  }

  // Convert base stats into our current Battle V1 derived stats.
  const attack = calculateBattleNonHpStat(actorBaseStat, actorPokemon.level);
  const defense = calculateBattleNonHpStat(targetBaseStat, targetPokemon.level);

  if (attack <= 0 || defense <= 0) {
    throw new Error(
      `Invalid battle stats while calculating damage for move "${move.id}"`
    );
  }

  // Core Pokémon-style damage before multiplicative modifiers.

  const level = actorPokemon.level;

  const levelFactor = Math.floor((2 * level) / 5) + 2;

  const baseDamage =
    Math.floor(Math.floor((levelFactor * move.power * attack) / defense) / 50) + 2;

  // STAB: move type matches one of the exact current form's types.
  const stabMultiplier = actorForm.types.includes(move.type) ? 1.5 : 1;

  // Type effectiveness: Supports dual typing and immunities.
  const typeEffectiveness = getCombinedTypeEffectiveness(move.type, targetForm.types);

  // Pokémon-style random damage factor: integer percentage from 85 to 100.
  const randomModifier = resolveBattleDamageRandomModifier(random);

  // Immunity must remain exactly zero.
  if (typeEffectiveness === 0) {
    return {
      damage: 0,
      baseDamage,
      power: move.power,
      attack,
      defense,
      damageClass: move.damageClass,
      stabMultiplier,
      typeEffectiveness,
      randomModifier,
    };
  }

  const modifiedDamage = Math.floor(
    baseDamage * stabMultiplier * typeEffectiveness * randomModifier
  );

  // A successful damaging move that is not immune deals at least 1 HP.

  const damage = Math.max(1, modifiedDamage);

  return {
    damage,
    baseDamage,
    power: move.power,
    attack,
    defense,
    damageClass: move.damageClass,
    stabMultiplier,
    typeEffectiveness,
    randomModifier,
  };
}

export function resolveBattleDamageRandomModifier(
  random: BattleMoveDamageRandomSource
): number {
  const roll = random();

  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) {
    throw new Error(
      `Battle damage RNG must return a number in [0, 1), received "${roll}"`
    );
  }

  // 16 possible integer values: 85, 86, 87, ... 100
  const percentage = 85 + Math.floor(roll * 16);
  return percentage / 100;
}

function getBattlePokemonForm(
  speciesId: number,

  formId: number
): PokemonForm {
  const form = getPokemonForm(formId);

  if (!form || form.speciesId !== speciesId) {
    throw new Error(
      `Pokémon form "${formId}" not found for species "${speciesId}" while calculating battle damage`
    );
  }

  return form;
}
