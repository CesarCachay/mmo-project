import { getPokemonLearnset } from "../pokemon-learnset.registry.js";
import { getPokemonMove } from "../pokemon-move.registry.js";

import type { PokemonInstanceMove, PokemonMove } from "../pokemon.types.js";

export interface PokemonLevelUpMoveCandidate {
  readonly moveId: number;
  readonly learnedAtLevel: number;
  readonly move: PokemonMove;
  readonly alreadyKnown: boolean;
}

export interface ResolvePokemonLevelUpMovesInput {
  readonly speciesId: number;
  readonly crossedLevels: readonly number[];
  readonly currentMoves: readonly PokemonInstanceMove[];
}

export function resolvePokemonLevelUpMoves(
  input: ResolvePokemonLevelUpMovesInput,
): readonly PokemonLevelUpMoveCandidate[] {
  const { speciesId, crossedLevels, currentMoves } = input;

  if (crossedLevels.length === 0) {
    return [];
  }

  assertValidCrossedLevels(crossedLevels);

  const learnset = getPokemonLearnset(speciesId);

  if (!learnset) {
    throw new Error(`Pokémon learnset not found for species "${speciesId}"`);
  }

  const crossedLevelSet = new Set(crossedLevels);

  const knownMoveIds = new Set(currentMoves.map((move) => move.moveId));

  const candidates: PokemonLevelUpMoveCandidate[] = [];

  for (const entry of learnset.levelUpMoves) {
    if (!crossedLevelSet.has(entry.level)) {
      continue;
    }

    const move = getPokemonMove(entry.moveId);

    if (!move) {
      throw new Error(
        `Pokémon move "${entry.moveId}" not found while resolving level-up moves for species "${speciesId}"`,
      );
    }

    candidates.push({
      moveId: entry.moveId,
      learnedAtLevel: entry.level,
      move,
      alreadyKnown: knownMoveIds.has(entry.moveId),
    });
  }

  return candidates.sort((a, b) => {
    if (a.learnedAtLevel !== b.learnedAtLevel) {
      return a.learnedAtLevel - b.learnedAtLevel;
    }

    return a.moveId - b.moveId;
  });
}

function assertValidCrossedLevels(crossedLevels: readonly number[]): void {
  let previousLevel = 0;

  for (const level of crossedLevels) {
    if (!Number.isInteger(level) || level <= 0) {
      throw new Error(`Invalid crossed Pokémon level "${level}"`);
    }

    if (level <= previousLevel) {
      throw new Error(`Crossed Pokémon levels must be strictly ascending`);
    }

    previousLevel = level;
  }
}
