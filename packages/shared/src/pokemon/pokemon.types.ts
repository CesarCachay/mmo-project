import { PokemonInventory } from "./inventory/pokemon-inventory.js";

export type PokemonType =
  | "normal"
  | "fire"
  | "water"
  | "electric"
  | "grass"
  | "ice"
  | "fighting"
  | "poison"
  | "ground"
  | "flying"
  | "psychic"
  | "bug"
  | "rock"
  | "ghost"
  | "dragon"
  | "dark"
  | "steel"
  | "fairy";

export interface PokemonBaseStats {
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
}

export interface PokemonSpecies {
  id: number;
  name: string;
  types: PokemonType[];
  baseStats: PokemonBaseStats;
  height: number;
  weight: number;
  baseExperience: number | null;
  captureRate: number;
  generation: number;
  evolutionChainId: number | null;
}

export interface PokemonEvolutionNode {
  speciesId: number;
  evolvesTo: PokemonEvolutionNode[];
}

export interface PokemonEvolutionChain {
  id: number;
  root: PokemonEvolutionNode;
}

export type PokemonDamageClass = "physical" | "special" | "status";

export interface PokemonMove {
  id: number;
  name: string;
  type: PokemonType;

  power: number | null;
  accuracy: number | null;
  pp: number | null;

  priority: number;
  damageClass: PokemonDamageClass;
}

export interface PokemonLevelUpMove {
  moveId: number;
  level: number;
}

export interface PokemonLearnset {
  speciesId: number;
  levelUpMoves: PokemonLevelUpMove[];
}

export interface PokemonAbilitySlot {
  abilityId: number;
  slot: number;
  isHidden: boolean;
}

export interface PokemonAbilitySet {
  speciesId: number;
  abilities: PokemonAbilitySlot[];
}

export interface PokemonAbility {
  id: number;
  name: string;
}

export interface PokemonForm {
  formId: number;
  pokemonId: number;
  speciesId: number;

  name: string;
  formName: string;

  isDefault: boolean;
  isMega: boolean;
  isBattleOnly: boolean;

  types: PokemonType[];
  baseStats: PokemonBaseStats;

  height: number;
  weight: number;
}

export type PokemonTypeEffectiveness = 0 | 0.5 | 1 | 2;

export interface PokemonInstanceMove {
  moveId: number;
  currentPp: number;
}

export interface PokemonInstance {
  instanceId: string;
  speciesId: number;
  formId: number;
  nickname?: string;
  level: number;
  experience: number;
  currentHp: number;
  abilityId: number;
  moves: PokemonInstanceMove[];
}

// Pokemon Party
export const MAX_POKEMON_PARTY_SIZE = 6;

export interface PokemonParty {
  pokemon: PokemonInstance[];
}

export interface PokemonTrainerState {
  party: PokemonParty;
  inventory: PokemonInventory;
}

// Follower for multiplayers
export interface PokemonFollowerPublicState {
  speciesId: number;
  formId: number;
}
