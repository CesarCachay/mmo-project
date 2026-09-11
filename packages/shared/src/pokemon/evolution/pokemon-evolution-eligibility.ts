import { getPokemonDirectEvolutions } from "../pokemon-evolution.registry.js";

import type {
  PokemonEvolutionDetail,
  PokemonEvolutionNode,
} from "../pokemon.types.js";

import {
  MAX_POKEMON_LEVEL,
  MIN_POKEMON_LEVEL,
} from "../progression/pokemon-experience.js";

export interface EvaluatePokemonLevelEvolutionInput {
  readonly speciesId: number;
  readonly level: number;
}

export interface PokemonLevelEvolutionCandidate {
  readonly sourceSpeciesId: number;
  readonly targetSpeciesId: number;
  readonly minLevel: number;
  readonly detail: PokemonEvolutionDetail;
}

export type PokemonLevelEvolutionIneligibilityReason =
  "no-direct-evolutions" | "no-supported-level-evolutions" | "level-too-low";

export type PokemonLevelEvolutionEvaluation =
  | {
      readonly status: "eligible";
      readonly candidate: PokemonLevelEvolutionCandidate;
    }
  | {
      readonly status: "not-eligible";
      readonly sourceSpeciesId: number;
      readonly level: number;
      readonly reason: PokemonLevelEvolutionIneligibilityReason;
    }
  | {
      /*
       * Defensive state.
       *
       * Evolution V1 must never silently choose between
       * multiple simultaneously eligible target species.
       */
      readonly status: "ambiguous";
      readonly sourceSpeciesId: number;
      readonly level: number;
      readonly candidates: readonly PokemonLevelEvolutionCandidate[];
    };

export function evaluatePokemonLevelEvolution(
  input: EvaluatePokemonLevelEvolutionInput,
): PokemonLevelEvolutionEvaluation {
  assertValidInput(input);

  const { speciesId, level } = input;

  const directEvolutions = getPokemonDirectEvolutions(speciesId);

  if (directEvolutions.length === 0) {
    return {
      status: "not-eligible",
      sourceSpeciesId: speciesId,
      level,
      reason: "no-direct-evolutions",
    };
  }

  const supportedCandidates = directEvolutions.flatMap((target) =>
    resolveSupportedLevelCandidates(speciesId, target),
  );

  if (supportedCandidates.length === 0) {
    return {
      status: "not-eligible",
      sourceSpeciesId: speciesId,
      level,
      reason: "no-supported-level-evolutions",
    };
  }

  /*
   * Deduplicate by target species.
   *
   * If static data ever contains multiple equivalent level-only
   * details for the same target, use the lowest valid threshold.
   */
  const eligibleByTargetSpeciesId = new Map<
    number,
    PokemonLevelEvolutionCandidate
  >();

  for (const candidate of supportedCandidates) {
    if (level < candidate.minLevel) {
      continue;
    }

    const existing = eligibleByTargetSpeciesId.get(candidate.targetSpeciesId);

    if (!existing || candidate.minLevel < existing.minLevel) {
      eligibleByTargetSpeciesId.set(candidate.targetSpeciesId, candidate);
    }
  }

  const eligibleCandidates = [...eligibleByTargetSpeciesId.values()];

  if (eligibleCandidates.length === 0) {
    return {
      status: "not-eligible",
      sourceSpeciesId: speciesId,
      level,
      reason: "level-too-low",
    };
  }

  if (eligibleCandidates.length > 1) {
    return {
      status: "ambiguous",
      sourceSpeciesId: speciesId,
      level,
      candidates: eligibleCandidates,
    };
  }

  return {
    status: "eligible",
    candidate: eligibleCandidates[0]!,
  };
}

/*
 * Evolution V1 supports ONLY genuinely level-only evolutions.
 *
 * A "level-up" trigger is not enough by itself because some
 * Pokémon additionally require friendship, gender, time of day,
 * location, party composition, physical-stat comparison, etc.
 */
export function isPokemonPureLevelEvolutionDetail(
  detail: PokemonEvolutionDetail,
): detail is PokemonEvolutionDetail & {
  readonly trigger: "level-up";
  readonly minLevel: number;
} {
  return (
    detail.trigger === "level-up" &&
    detail.minLevel !== null &&
    Number.isInteger(detail.minLevel) &&
    detail.minLevel > 0 &&
    detail.itemId === null &&
    detail.gender === null &&
    detail.heldItemId === null &&
    detail.knownMoveId === null &&
    detail.knownMoveTypeId === null &&
    detail.locationId === null &&
    detail.minHappiness === null &&
    detail.minBeauty === null &&
    detail.minAffection === null &&
    detail.nearSpecialRock === false &&
    detail.needsOverworldRain === false &&
    detail.partySpeciesId === null &&
    detail.partyTypeId === null &&
    detail.relativePhysicalStats === null &&
    detail.timeOfDay === "" &&
    detail.tradeSpeciesId === null &&
    detail.turnUpsideDown === false
  );
}

function resolveSupportedLevelCandidates(
  sourceSpeciesId: number,
  target: PokemonEvolutionNode,
): PokemonLevelEvolutionCandidate[] {
  return target.evolutionDetails
    .filter(isPokemonPureLevelEvolutionDetail)
    .map((detail) => ({
      sourceSpeciesId,
      targetSpeciesId: target.speciesId,
      minLevel: detail.minLevel,
      detail: {
        ...detail,
      },
    }));
}

function assertValidInput(input: EvaluatePokemonLevelEvolutionInput): void {
  if (!Number.isInteger(input.speciesId) || input.speciesId <= 0) {
    throw new Error(
      `Pokémon species id must be a positive integer. Received "${input.speciesId}"`,
    );
  }

  if (
    !Number.isInteger(input.level) ||
    input.level < MIN_POKEMON_LEVEL ||
    input.level > MAX_POKEMON_LEVEL
  ) {
    throw new Error(
      [
        "Pokémon evolution level must be an integer between",
        `${MIN_POKEMON_LEVEL} and ${MAX_POKEMON_LEVEL}.`,
        `Received "${input.level}"`,
      ].join(" "),
    );
  }
}
