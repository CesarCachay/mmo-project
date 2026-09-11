import evolutionChainsData from "./data/evolution-chains.json" with { type: "json" };

import type {
  PokemonEvolutionChain,
  PokemonEvolutionNode,
} from "./pokemon.types.js";

const evolutionChains = evolutionChainsData as PokemonEvolutionChain[];

const EVOLUTION_CHAINS = new Map<number, PokemonEvolutionChain>(
  evolutionChains.map((chain) => [chain.id, chain]),
);

const EVOLUTION_NODES_BY_SPECIES_ID = new Map<number, PokemonEvolutionNode>();

for (const chain of evolutionChains) {
  indexEvolutionNode(chain.root);
}

export function getPokemonEvolutionChain(
  id: number,
): PokemonEvolutionChain | undefined {
  return EVOLUTION_CHAINS.get(id);
}

export function getPokemonEvolutionNode(
  speciesId: number,
): PokemonEvolutionNode | undefined {
  return EVOLUTION_NODES_BY_SPECIES_ID.get(speciesId);
}

export function getPokemonDirectEvolutions(
  speciesId: number,
): readonly PokemonEvolutionNode[] {
  return getPokemonEvolutionNode(speciesId)?.evolvesTo ?? [];
}

export function getPokemonEvolutionChainCount(): number {
  return EVOLUTION_CHAINS.size;
}

function indexEvolutionNode(node: PokemonEvolutionNode): void {
  if (EVOLUTION_NODES_BY_SPECIES_ID.has(node.speciesId)) {
    throw new Error(
      `Duplicate Pokémon evolution node for species "${node.speciesId}"`,
    );
  }

  EVOLUTION_NODES_BY_SPECIES_ID.set(node.speciesId, node);

  for (const child of node.evolvesTo) {
    indexEvolutionNode(child);
  }
}
