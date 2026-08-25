import movesData from "./data/moves.json" with { type: "json" };
import type { PokemonMove, PokemonType, PokemonDamageClass } from "./pokemon.types.js";

const POKEMON_MOVES = new Map<number, PokemonMove>(
  movesData.map((move) => [
    move.id,
    {
      id: move.id,
      name: move.name,
      type: move.type as PokemonType,
      power: move.power,
      accuracy: move.accuracy,
      pp: move.pp,
      priority: move.priority,
      damageClass: move.damageClass as PokemonDamageClass,
    },
  ])
);

export function getPokemonMove(id: number): PokemonMove | undefined {
  return POKEMON_MOVES.get(id);
}

export function getAllPokemonMoves(): PokemonMove[] {
  return Array.from(POKEMON_MOVES.values());
}

export function getPokemonMoveCount(): number {
  return POKEMON_MOVES.size;
}
