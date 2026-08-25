import evolutionChainsData from "./data/evolution-chains.json" with { type: "json" };
import type { PokemonEvolutionChain } from "./pokemon.types.js";

const EVOLUTION_CHAINS = new Map<number, PokemonEvolutionChain>(
  evolutionChainsData.map((chain) => [chain.id, chain])
);

export function getPokemonEvolutionChain(id: number): PokemonEvolutionChain | undefined {
  return EVOLUTION_CHAINS.get(id);
}

export function getPokemonEvolutionChainCount(): number {
  return EVOLUTION_CHAINS.size;
}
