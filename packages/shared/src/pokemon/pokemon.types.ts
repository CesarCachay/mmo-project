import { PokemonInventory } from "./inventory/pokemon-inventory.js";
import type { PokemonMoney } from "./economy/pokemon-money.js";
import type { PokemonGrowthRate } from "./progression/pokemon-growth-rate.js";
import type { PokemonGymBadgeId } from "./trainers/pokemon-gym.types.js";

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

  growthRate: PokemonGrowthRate;

  captureRate: number;
  generation: number;
  evolutionChainId: number | null;
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

export const MAX_POKEMON_MOVE_SLOTS = 4;

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
  money: PokemonMoney;
  /** Persisted one-time Trainer Battle victories. Optional for backwards-compatible tests/fixtures. */
  defeatedTrainerBattleIds?: readonly string[];
  /** Permanently earned Gym badges. Optional for backwards-compatible tests/fixtures. */
  earnedGymBadgeIds?: readonly PokemonGymBadgeId[];
}

// Follower for multiplayers
export interface PokemonFollowerPublicState {
  speciesId: number;
  formId: number;
}

// Evolution
export interface PokemonEvolutionDetail {
  trigger: string;
  itemId: number | null;
  minLevel: number | null;
  gender: number | null;
  heldItemId: number | null;
  knownMoveId: number | null;
  knownMoveTypeId: number | null;
  locationId: number | null;
  minHappiness: number | null;
  minBeauty: number | null;
  minAffection: number | null;
  nearSpecialRock: boolean;
  needsOverworldRain: boolean;
  partySpeciesId: number | null;
  partyTypeId: number | null;
  relativePhysicalStats: number | null;
  timeOfDay: string;
  tradeSpeciesId: number | null;
  turnUpsideDown: boolean;
}

export interface PokemonEvolutionNode {
  speciesId: number;
  evolutionDetails: PokemonEvolutionDetail[];
  evolvesTo: PokemonEvolutionNode[];
}

export interface PokemonEvolutionChain {
  id: number;
  root: PokemonEvolutionNode;
}
