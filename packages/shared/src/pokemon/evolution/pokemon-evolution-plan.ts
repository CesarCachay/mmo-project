import { getPokemonAbilitySet } from "../pokemon-ability-set.registry.js";
import { getPokemonFormsBySpecies } from "../pokemon-form.registry.js";

import { calculatePokemonMaxHp } from "../pokemon-stat.js";

import type {
  PokemonAbilitySlot,
  PokemonForm,
  PokemonInstance,
  PokemonInstanceMove,
} from "../pokemon.types.js";

import {
  isPokemonPureLevelEvolutionDetail,
  type PokemonLevelEvolutionCandidate,
} from "./pokemon-evolution-eligibility.js";

import { getPokemonSpecies } from "../pokemon.registry.js";
import { assertPokemonExperienceCompatibleWithLevel } from "../progression/pokemon-progression-invariant.js";

export interface PlanPokemonEvolutionInput {
  readonly pokemon: PokemonInstance;
  readonly candidate: PokemonLevelEvolutionCandidate;
}

export interface PokemonEvolutionAbilityTransition {
  readonly slot: number;

  readonly sourceAbilityId: number;
  readonly targetAbilityId: number;

  readonly isHidden: boolean;
}

export interface PokemonEvolutionHpTransition {
  readonly sourceMaxHp: number;
  readonly targetMaxHp: number;

  readonly sourceCurrentHp: number;
  readonly targetCurrentHp: number;

  readonly missingHp: number;
}

export interface PokemonEvolutionPlan {
  readonly pokemonInstanceId: string;

  readonly sourceSpeciesId: number;
  readonly targetSpeciesId: number;

  readonly sourceFormId: number;
  readonly targetFormId: number;

  readonly ability: PokemonEvolutionAbilityTransition;
  readonly hp: PokemonEvolutionHpTransition;

  /*
   * Complete Pokémon state after evolution.
   *
   * Identity, nickname, level, EXP and moves are preserved.
   * Species, form, ability and HP are transformed.
   */
  readonly evolvedPokemonState: PokemonInstance;
}

export function planPokemonEvolution(
  input: PlanPokemonEvolutionInput,
): PokemonEvolutionPlan {
  const { pokemon, candidate } = input;

  validateEvolutionCandidate(pokemon, candidate);

  const targetSpecies = getPokemonSpecies(candidate.targetSpeciesId);

  if (!targetSpecies) {
    throw new Error(
      `Evolution target species "${candidate.targetSpeciesId}" not found`,
    );
  }

  /*
   * Evolution preserves EXP.
   *
   * Therefore that same EXP must remain valid for the
   * target species growth curve.
   */
  assertPokemonExperienceCompatibleWithLevel(
    targetSpecies.growthRate,
    pokemon.level,
    pokemon.experience,
  );

  /*
   * --------------------------------------------------
   * 1. Resolve target default form
   * --------------------------------------------------
   */
  const targetForm = resolveEvolutionTargetForm(candidate.targetSpeciesId);

  /*
   * --------------------------------------------------
   * 2. Preserve logical Ability slot
   * --------------------------------------------------
   */
  const ability = resolveEvolutionAbilityTransition(
    pokemon,
    candidate.targetSpeciesId,
  );

  /*
   * --------------------------------------------------
   * 3. HP transformation
   * --------------------------------------------------
   */
  const sourceMaxHp = calculatePokemonMaxHp(pokemon);

  assertValidCurrentHp(pokemon, sourceMaxHp);

  const targetMaxHp = calculatePokemonMaxHp({
    speciesId: candidate.targetSpeciesId,
    formId: targetForm.formId,
    level: pokemon.level,
  });

  const missingHp = sourceMaxHp - pokemon.currentHp;

  const targetCurrentHp =
    pokemon.currentHp <= 0 ? 0 : Math.max(1, targetMaxHp - missingHp);

  /*
   * --------------------------------------------------
   * 4. Build transformed state
   * --------------------------------------------------
   *
   * IMPORTANT:
   *
   * We transform the SAME Pokémon instance.
   *
   * No UUID regeneration.
   * No EXP reset.
   * No move reconstruction.
   * No nickname loss.
   */
  const evolvedPokemonState: PokemonInstance = {
    ...pokemon,
    speciesId: candidate.targetSpeciesId,
    formId: targetForm.formId,
    abilityId: ability.targetAbilityId,
    currentHp: targetCurrentHp,
    /*
     * Explicit clone prevents the evolution plan from
     * sharing the original mutable moves array.
     */
    moves: cloneMoves(pokemon.moves),
  };

  return {
    pokemonInstanceId: pokemon.instanceId,
    sourceSpeciesId: pokemon.speciesId,
    targetSpeciesId: candidate.targetSpeciesId,
    sourceFormId: pokemon.formId,
    targetFormId: targetForm.formId,
    ability,
    hp: {
      sourceMaxHp,
      targetMaxHp,
      sourceCurrentHp: pokemon.currentHp,
      targetCurrentHp,
      missingHp,
    },
    evolvedPokemonState,
  };
}

function resolveEvolutionTargetForm(targetSpeciesId: number): PokemonForm {
  const forms = getPokemonFormsBySpecies(targetSpeciesId);

  /*
   * Prefer the canonical/base Pokémon form.
   *
   * pokemonId === speciesId protects us from accidentally
   * selecting an alternate variety belonging to the species.
   */
  const baseDefaultForm = forms.find(
    (form) =>
      form.pokemonId === targetSpeciesId &&
      form.isDefault &&
      !form.isMega &&
      !form.isBattleOnly,
  );

  if (baseDefaultForm) {
    return baseDefaultForm;
  }

  /*
   * Defensive fallback for datasets where the canonical
   * form is not represented with pokemonId === speciesId.
   *
   * Never automatically select Mega/Battle-only forms.
   */
  const defaultForm = forms.find(
    (form) => form.isDefault && !form.isMega && !form.isBattleOnly,
  );

  if (!defaultForm) {
    throw new Error(
      [
        "Default evolution target form not found",
        `for species "${targetSpeciesId}"`,
      ].join(" "),
    );
  }

  return defaultForm;
}

function resolveEvolutionAbilityTransition(
  pokemon: PokemonInstance,
  targetSpeciesId: number,
): PokemonEvolutionAbilityTransition {
  const sourceAbilitySet = getPokemonAbilitySet(pokemon.speciesId);

  if (!sourceAbilitySet) {
    throw new Error(
      `Pokémon ability set not found for source species "${pokemon.speciesId}"`,
    );
  }

  const sourceAbilityMatches = sourceAbilitySet.abilities.filter(
    (entry) => entry.abilityId === pokemon.abilityId,
  );

  if (sourceAbilityMatches.length === 0) {
    throw new Error(
      [
        `Pokémon ability "${pokemon.abilityId}"`,
        `does not belong to source species "${pokemon.speciesId}"`,
      ].join(" "),
    );
  }

  /*
   * PokemonInstance currently persists abilityId, not slot.
   *
   * Therefore slot inference must be deterministic.
   */
  if (sourceAbilityMatches.length > 1) {
    throw new Error(
      [
        `Pokémon ability "${pokemon.abilityId}"`,
        `maps to multiple slots for species "${pokemon.speciesId}"`,
      ].join(" "),
    );
  }

  const sourceAbility = sourceAbilityMatches[0]!;

  const targetAbilitySet = getPokemonAbilitySet(targetSpeciesId);

  if (!targetAbilitySet) {
    throw new Error(
      `Pokémon ability set not found for target species "${targetSpeciesId}"`,
    );
  }

  const targetAbilityMatches = targetAbilitySet.abilities.filter(
    (entry) => entry.slot === sourceAbility.slot,
  );

  if (targetAbilityMatches.length !== 1) {
    throw new Error(
      [
        `Could not preserve ability slot "${sourceAbility.slot}"`,
        `while evolving species "${pokemon.speciesId}"`,
        `into "${targetSpeciesId}"`,
      ].join(" "),
    );
  }

  const targetAbility = targetAbilityMatches[0]!;

  /*
   * Slot preservation must not silently transform
   * a hidden ability into a standard ability or vice versa.
   */
  if (targetAbility.isHidden !== sourceAbility.isHidden) {
    throw new Error(
      [
        `Ability slot "${sourceAbility.slot}" changes hidden-status`,
        `while evolving species "${pokemon.speciesId}"`,
        `into "${targetSpeciesId}"`,
      ].join(" "),
    );
  }

  return createAbilityTransition(sourceAbility, targetAbility);
}

function createAbilityTransition(
  source: PokemonAbilitySlot,
  target: PokemonAbilitySlot,
): PokemonEvolutionAbilityTransition {
  return {
    slot: source.slot,

    sourceAbilityId: source.abilityId,
    targetAbilityId: target.abilityId,

    isHidden: source.isHidden,
  };
}

function validateEvolutionCandidate(
  pokemon: PokemonInstance,
  candidate: PokemonLevelEvolutionCandidate,
): void {
  if (candidate.sourceSpeciesId !== pokemon.speciesId) {
    throw new Error(
      [
        "Evolution candidate source species mismatch.",
        `Pokémon="${pokemon.speciesId}",`,
        `candidate="${candidate.sourceSpeciesId}"`,
      ].join(" "),
    );
  }

  if (candidate.targetSpeciesId === pokemon.speciesId) {
    throw new Error(
      `Evolution target species cannot equal source species "${pokemon.speciesId}"`,
    );
  }

  if (!isPokemonPureLevelEvolutionDetail(candidate.detail)) {
    throw new Error(
      [
        "Evolution candidate is not supported",
        "by Evolution V1 level-only rules",
      ].join(" "),
    );
  }

  if (candidate.detail.minLevel !== candidate.minLevel) {
    throw new Error(
      "Evolution candidate minLevel does not match its evolution detail",
    );
  }

  if (pokemon.level < candidate.minLevel) {
    throw new Error(
      [
        `Pokémon level "${pokemon.level}"`,
        `does not satisfy evolution minimum level "${candidate.minLevel}"`,
      ].join(" "),
    );
  }
}

function assertValidCurrentHp(pokemon: PokemonInstance, maxHp: number): void {
  if (
    !Number.isInteger(pokemon.currentHp) ||
    pokemon.currentHp < 0 ||
    pokemon.currentHp > maxHp
  ) {
    throw new Error(
      [
        `Pokémon currentHp "${pokemon.currentHp}"`,
        `is invalid for maxHp "${maxHp}"`,
        `instance="${pokemon.instanceId}"`,
      ].join(" "),
    );
  }
}

function cloneMoves(
  moves: readonly PokemonInstanceMove[],
): PokemonInstanceMove[] {
  return moves.map((move) => ({
    ...move,
  }));
}
