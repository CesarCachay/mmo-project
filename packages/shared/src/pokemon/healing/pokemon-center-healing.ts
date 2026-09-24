import { getPokemonMove } from "../pokemon-move.registry.js";
import { calculatePokemonMaxHp } from "../pokemon-stat.js";

import type {
  PokemonInstance,
  PokemonInstanceMove,
  PokemonParty,
} from "../pokemon.types.js";

export interface PokemonCenterHealingPlan {
  readonly updatedParty: PokemonParty;
  readonly restoredPokemonCount: number;
  readonly totalHpRestored: number;
  readonly totalPpRestored: number;
}

export function planPokemonCenterHealing(party: PokemonParty): PokemonCenterHealingPlan {
  let restoredPokemonCount = 0;
  let totalHpRestored = 0;
  let totalPpRestored = 0;

  const pokemon = party.pokemon.map((currentPokemon) => {
    const maxHp = calculatePokemonMaxHp(currentPokemon);

    const hpRestored = Math.max(0, maxHp - currentPokemon.currentHp);

    let pokemonPpRestored = 0;

    const moves = currentPokemon.moves.map((move) => {
      const healedMove = restorePokemonMovePp(move);

      pokemonPpRestored += Math.max(0, healedMove.currentPp - move.currentPp);

      return healedMove;
    });

    if (
      currentPokemon.currentHp !== maxHp ||
      currentPokemon.majorStatus != null ||
      moves.some(
        (move, index) => move.currentPp !== currentPokemon.moves[index]?.currentPp
      )
    ) {
      restoredPokemonCount += 1;
    }

    totalHpRestored += hpRestored;
    totalPpRestored += pokemonPpRestored;

    return restorePokemon(currentPokemon, maxHp, moves);
  });

  return {
    updatedParty: {
      ...party,
      pokemon,
    },
    restoredPokemonCount,
    totalHpRestored,
    totalPpRestored,
  };
}

function restorePokemonMovePp(move: PokemonInstanceMove): PokemonInstanceMove {
  const definition = getPokemonMove(move.moveId);

  if (!definition) {
    throw new Error(
      `Pokémon move "${move.moveId}" not found while planning Pokémon Center healing`
    );
  }

  return {
    ...move,
    currentPp: definition.pp ?? 0,
  };
}

function restorePokemon(
  pokemon: PokemonInstance,
  maxHp: number,
  moves: PokemonInstanceMove[]
): PokemonInstance {
  return {
    ...pokemon,
    currentHp: maxHp,
    ...(pokemon.majorStatus !== undefined ? { majorStatus: null } : {}),
    moves,
  };
}
