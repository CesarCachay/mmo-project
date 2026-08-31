import { getPokemonFormsBySpecies } from "../pokemon-form.registry.js";

import type { BattleMoveExecutionContext } from "./pokemon-battle-move-execution.js";

export interface BattleMoveDamageResult {
  readonly damage: number;
  readonly power: number | null;
  readonly attack: number | null;
  readonly defense: number | null;
  readonly damageClass: "physical" | "special" | "status";
}

export function calculateBattleMoveDamage(
  context: BattleMoveExecutionContext
): BattleMoveDamageResult {
  const move = context.move;

  //
  // Status moves do not deal direct
  // damage in this foundation.
  //

  if (move.damageClass === "status") {
    return {
      damage: 0,
      power: move.power,
      attack: null,
      defense: null,
      damageClass: move.damageClass,
    };
  }

  //
  // Some moves may have no normal
  // damage power.
  //
  // We are not implementing special
  // fixed-damage mechanics yet.
  //

  if (move.power === null) {
    return {
      damage: 0,
      power: null,
      attack: null,
      defense: null,
      damageClass: move.damageClass,
    };
  }

  if (!Number.isInteger(move.power) || move.power <= 0) {
    throw new Error(`Invalid move power "${move.power}" for move "${move.id}"`);
  }

  const actorStats = getBattlePokemonBaseStats(
    context.actorPokemon.pokemon.speciesId,
    context.actorPokemon.pokemon.formId
  );

  const targetStats = getBattlePokemonBaseStats(
    context.targetPokemon.pokemon.speciesId,
    context.targetPokemon.pokemon.formId
  );

  let attack: number;
  let defense: number;

  switch (move.damageClass) {
    case "physical": {
      attack = actorStats.attack;
      defense = targetStats.defense;
      break;
    }

    case "special": {
      attack = actorStats.specialAttack;
      defense = targetStats.specialDefense;
      break;
    }

    default: {
      throw new Error(`Unsupported move damage class "${move.damageClass}"`);
    }
  }

  if (attack <= 0 || defense <= 0) {
    throw new Error(
      `Invalid battle stats while calculating damage for move "${move.id}"`
    );
  }

  const level = context.actorPokemon.pokemon.level;

  //
  // Simplified Pokémon-style base
  // damage formula.
  //
  // No STAB.
  // No type effectiveness.
  // No critical.
  // No random modifier.
  // No burn.
  // No abilities/items/weather.
  //

  const damage = Math.max(
    1,
    Math.floor((Math.floor((2 * level) / 5 + 2) * move.power * attack) / defense / 50) + 2
  );

  return {
    damage,
    power: move.power,
    attack,
    defense,
    damageClass: move.damageClass,
  };
}

function getBattlePokemonBaseStats(speciesId: number, formId: number) {
  const forms = getPokemonFormsBySpecies(speciesId);

  const form = forms.find((candidate) => candidate.formId === formId);

  if (!form) {
    throw new Error(
      `Pokémon form "${formId}" not found for species "${speciesId}" while calculating battle damage`
    );
  }

  return form.baseStats;
}
