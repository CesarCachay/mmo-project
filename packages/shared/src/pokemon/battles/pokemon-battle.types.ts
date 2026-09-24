import type { PokemonInstance } from "../pokemon.types.js";
import type { BattlePokemonStatusState } from "./pokemon-battle-status.js";

export type BattleId = string;

export type BattleType = "wild" | "trainer";

export type BattleStatus = "active" | "completed";

export type BattleSide = "side-a" | "side-b";

export type BattleParticipantId = string;

export type BattleParticipantType = "trainer" | "wild";

export type BattleWeatherType = "rain" | "sun" | "sandstorm" | "hail";

export interface BattleWeatherState {
  readonly type: BattleWeatherType;
  remainingTurns: number;
}

export interface BattleSideHazards {
  spikesLayers: number;
  toxicSpikesLayers: number;
  stealthRock: boolean;
}

export interface BattleFieldEffectsState {
  trickRoomRemainingTurns: number;
  gravityRemainingTurns: number;
}

export interface BattleFieldState {
  weather: BattleWeatherState | null;
  readonly hazards: Record<BattleSide, BattleSideHazards>;
  readonly effects: BattleFieldEffectsState;
}

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

  /**
   * Battle-runtime status state. Optional only for backwards compatibility
   * with historical fixtures/snapshots created before Status Conditions V1.
   * New battle states created by createBattlePokemonState always initialize it.
   */
  statusState?: BattlePokemonStatusState;
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

  /** Optional presentation name for an owned roster (for example, an NPC Trainer). */
  readonly displayName?: string;

  readonly pokemon: readonly BattlePokemonState[];
  activePokemonIndex: number;
}

interface BattleInstanceBase {
  readonly battleId: BattleId;
  readonly participants: readonly BattleParticipant[];
  readonly status: BattleStatus;
  fieldState?: BattleFieldState;
}

export interface WildBattleInstance extends BattleInstanceBase {
  readonly type: "wild";
}

export interface TrainerBattleInstance extends BattleInstanceBase {
  readonly type: "trainer";
}

/* Server-authoritative battle runtime instance */
export type BattleInstance = WildBattleInstance | TrainerBattleInstance;
