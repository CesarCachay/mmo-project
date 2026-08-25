import {
  MAX_POKEMON_PARTY_SIZE,
  type PokemonInstance,
  type PokemonParty,
} from "./pokemon.types.js";

export function createPokemonParty(): PokemonParty {
  return {
    pokemon: [],
  };
}

export function getPokemonPartySize(party: PokemonParty): number {
  return party.pokemon.length;
}

export function isPokemonPartyFull(party: PokemonParty): boolean {
  return party.pokemon.length >= MAX_POKEMON_PARTY_SIZE;
}

export function hasPokemonInstance(party: PokemonParty, instanceId: string): boolean {
  return party.pokemon.some((pokemon) => pokemon.instanceId === instanceId);
}

export function addPokemonToParty(
  party: PokemonParty,
  pokemon: PokemonInstance
): PokemonParty {
  if (hasPokemonInstance(party, pokemon.instanceId)) {
    throw new Error(`Pokémon instance ${pokemon.instanceId} is already in the party`);
  }

  if (isPokemonPartyFull(party)) {
    throw new Error(
      `Pokémon party cannot contain more than ${MAX_POKEMON_PARTY_SIZE} Pokémon`
    );
  }

  return {
    ...party,
    pokemon: [...party.pokemon, pokemon],
  };
}

export function removePokemonFromParty(
  party: PokemonParty,
  instanceId: string
): PokemonParty {
  if (!hasPokemonInstance(party, instanceId)) {
    throw new Error(`Pokémon instance ${instanceId} is not in the party`);
  }

  return {
    ...party,
    pokemon: party.pokemon.filter((pokemon) => pokemon.instanceId !== instanceId),
  };
}
