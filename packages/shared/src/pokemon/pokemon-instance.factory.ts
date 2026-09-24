import { getPokemonSpecies } from "./pokemon.registry.js";
import { getPokemonFormsBySpecies } from "./pokemon-form.registry.js";
import { getPokemonAbilitySet } from "./pokemon-ability-set.registry.js";
import { getPokemonLearnset } from "./pokemon-learnset.registry.js";
import { getPokemonMove } from "./pokemon-move.registry.js";
import {
  getExperienceForLevel,
  MAX_POKEMON_LEVEL,
} from "./progression/pokemon-experience.js";
import { MAX_POKEMON_MOVE_SLOTS } from "./pokemon.types.js";
import type { PokemonInstance, PokemonInstanceMove } from "./pokemon.types.js";

function getInitialHp(baseHp: number, level: number): number {
  return Math.floor((2 * baseHp * level) / 100) + level + 10;
}

function getInitialMoves(
  speciesId: number,
  level: number,
): PokemonInstanceMove[] {
  const learnset = getPokemonLearnset(speciesId);

  if (!learnset) {
    throw new Error(`Pokémon learnset not found for species ${speciesId}`);
  }

  const availableMoves = learnset.levelUpMoves
    .filter((entry) => entry.level <= level)
    .sort((a, b) => a.level - b.level);

  const moveIds: number[] = [];

  for (const entry of availableMoves) {
    const existingIndex = moveIds.indexOf(entry.moveId);

    if (existingIndex !== -1) {
      moveIds.splice(existingIndex, 1);
    }

    moveIds.push(entry.moveId);
  }

  return moveIds.slice(-MAX_POKEMON_MOVE_SLOTS).map((moveId) => {
    const move = getPokemonMove(moveId);

    if (!move) {
      throw new Error(`Pokémon move ${moveId} not found`);
    }

    return {
      moveId,
      currentPp: move.pp ?? 0,
    };
  });
}

export function createPokemonInstance(
  speciesId: number,
  level: number,
): PokemonInstance {
  if (!Number.isInteger(speciesId) || speciesId <= 0) {
    throw new Error(
      `Pokémon speciesId must be a positive integer. Received: ${speciesId}`,
    );
  }

  if (!Number.isInteger(level) || level < 1 || level > MAX_POKEMON_LEVEL) {
    throw new Error(
      `Pokémon level must be an integer between 1 and ${MAX_POKEMON_LEVEL}. Received: ${level}`,
    );
  }

  const species = getPokemonSpecies(speciesId);

  if (!species) {
    throw new Error(`Pokémon species ${speciesId} not found`);
  }

  const forms = getPokemonFormsBySpecies(speciesId);

  const defaultForm = forms.find((form) => form.isDefault);

  if (!defaultForm) {
    throw new Error(`Default Pokémon form not found for species ${speciesId}`);
  }

  const abilitySet = getPokemonAbilitySet(speciesId);

  if (!abilitySet) {
    throw new Error(`Pokémon ability set not found for species ${speciesId}`);
  }

  const ability = [...abilitySet.abilities]
    .sort((a, b) => a.slot - b.slot)
    .find((entry) => !entry.isHidden);

  if (!ability) {
    throw new Error(
      `No standard Pokémon ability found for species ${speciesId}`,
    );
  }

  const moves = getInitialMoves(speciesId, level);

  const currentHp = getInitialHp(defaultForm.baseStats.hp, level);

  const experience = getExperienceForLevel(species.growthRate, level);

  return {
    instanceId: globalThis.crypto.randomUUID(),
    speciesId,
    formId: defaultForm.formId,
    level,
    experience,
    currentHp,
    abilityId: ability.abilityId,
    majorStatus: null,
    moves,
  };
}
