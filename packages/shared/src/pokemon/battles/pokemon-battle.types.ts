import type { PokemonInstance } from "../pokemon.types.js";

export type BattleId = string;

export type BattleType = "wild" | "trainer";

export type BattleStatus = "active" | "completed";

export type BattleSide = "side-a" | "side-b";

export type BattleParticipantId = string;

export type BattleParticipantType = "trainer" | "wild";

/**
 * Represents the runtime state of one Pokémon
 * while it participates in a battle.
 *
 * `pokemon` is the base PokemonInstance.
 * Mutable battle-specific state lives directly
 * in BattlePokemonState instead of mutating the
 * persistent PokemonInstance during battle calculations.
 */
export interface BattlePokemonState {
  readonly pokemon: PokemonInstance;
  currentHp: number;
}

/**
 * Represents one participant in a battle.
 *
 * Participant `type` describes who owns the roster, not whether
 * the participant is locally controlled.
 *
 * Wild Battle:
 * side-a -> trainer
 * side-b -> wild
 *
 * Trainer Battle:
 * side-a -> trainer
 * side-b -> trainer
 *
 * `side` defines opposition. Local/player ownership is resolved by
 * the server battle-session binding, never by participant type.
 */
export interface BattleParticipant {
  readonly id: BattleParticipantId;
  readonly type: BattleParticipantType;
  readonly side: BattleSide;
  readonly pokemon: readonly BattlePokemonState[];
  activePokemonIndex: number;
}

interface BattleInstanceBase {
  readonly battleId: BattleId;
  readonly participants: readonly BattleParticipant[];
  readonly status: BattleStatus;
}

export interface WildBattleInstance extends BattleInstanceBase {
  readonly type: "wild";
}

export interface TrainerBattleInstance extends BattleInstanceBase {
  readonly type: "trainer";
}

/* Server-authoritative battle runtime instance */
export type BattleInstance = WildBattleInstance | TrainerBattleInstance;
