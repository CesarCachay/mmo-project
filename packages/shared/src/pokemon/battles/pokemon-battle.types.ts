import type { PokemonInstance } from "../pokemon.types.js";

export type BattleId = string;

export type BattleType = "wild";

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
 * In a wild battle:
 * side-a -> trainer
 * side-b -> wild
 * The battle domain itself does not depend on
 * "player" / "enemy" client-relative terminology.
 */
export interface BattleParticipant {
  readonly id: BattleParticipantId;
  readonly type: BattleParticipantType;
  readonly side: BattleSide;
  readonly pokemon: readonly BattlePokemonState[];
  activePokemonIndex: number;
}

/* Server-authoritative battle runtime instance */
export interface BattleInstance {
  readonly battleId: BattleId;
  readonly type: BattleType;
  readonly participants: readonly BattleParticipant[];
  readonly status: BattleStatus;
}
