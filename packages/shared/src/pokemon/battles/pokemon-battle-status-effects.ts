import { calculatePokemonMaxHp } from "../pokemon-stat.js";
import { getActiveBattlePokemon } from "./pokemon-battle-participant.js";
import { ensureBattlePokemonStatusState } from "./pokemon-battle-status.js";
import type {
  BattleInstance,
  BattleParticipantId,
  BattlePokemonState,
} from "./pokemon-battle.types.js";

export type BattleResidualStatusCondition =
  | "burn"
  | "poison"
  | "badly-poisoned";

export interface BattleEndTurnStatusDamageEffect {
  readonly type: "status-residual-damage";
  readonly participantId: BattleParticipantId;
  readonly pokemonInstanceId: string;
  readonly status: BattleResidualStatusCondition;
  readonly previousHp: number;
  readonly currentHp: number;
  readonly appliedDamage: number;
  readonly toxicCounter?: number;
}

export type BattleEndTurnStatusEffect = BattleEndTurnStatusDamageEffect;

const BURN_ATTACK_DIVISOR = 2;
const PARALYSIS_SPEED_DIVISOR = 4;
const STANDARD_RESIDUAL_DAMAGE_DIVISOR = 8;
const BAD_POISON_DAMAGE_DIVISOR = 16;
export const BATTLE_BAD_POISON_MAX_COUNTER = 15;

/**
 * Applies the Generation IV-style Burn Attack penalty used by Status
 * Conditions V1. This intentionally does not model ability exceptions yet.
 */
export function applyBattleStatusAttackModifier(
  pokemon: BattlePokemonState,
  attack: number,
): number {
  assertPositiveBattleStat("Attack", attack);

  const major = ensureBattlePokemonStatusState(pokemon).major;

  if (major?.type !== "burn") {
    return attack;
  }

  return Math.max(1, Math.floor(attack / BURN_ATTACK_DIVISOR));
}

/**
 * Generation IV paralysis reduces effective Speed to one quarter.
 */
export function applyBattleStatusSpeedModifier(
  pokemon: BattlePokemonState,
  speed: number,
): number {
  assertPositiveBattleStat("Speed", speed);

  const major = ensureBattlePokemonStatusState(pokemon).major;

  if (major?.type !== "paralysis") {
    return speed;
  }

  return Math.max(1, Math.floor(speed / PARALYSIS_SPEED_DIVISOR));
}

/**
 * Resolves end-of-turn residual damage exactly once for each currently active,
 * non-fainted Pokémon.
 *
 * Battle V1 still does not support simultaneous defeat. To preserve that
 * existing invariant, residual processing stops after the first residual KO.
 * Battle Mechanics Completeness can later replace this guard with full
 * simultaneous-faint resolution.
 */
export function applyBattleEndTurnStatusEffects(
  battle: BattleInstance,
): readonly BattleEndTurnStatusEffect[] {
  if (battle.status !== "active") {
    throw new Error(
      `Cannot apply end-turn status effects to battle "${battle.battleId}" with status "${battle.status}"`,
    );
  }

  const effects: BattleEndTurnStatusEffect[] = [];

  // Battle V1 resolves faint/replacement before another end-turn status pass.
  // Skipping residuals when a Pokémon is already fainted prevents a direct-KO
  // plus residual KO from entering the unsupported simultaneous-defeat state.
  if (
    battle.participants.some(
      (participant) => getActiveBattlePokemon(participant).currentHp <= 0,
    )
  ) {
    return effects;
  }

  for (const participant of battle.participants) {
    const pokemon = getActiveBattlePokemon(participant);

    if (pokemon.currentHp <= 0) {
      continue;
    }

    const status = ensureBattlePokemonStatusState(pokemon).major;

    if (
      status?.type !== "burn" &&
      status?.type !== "poison" &&
      status?.type !== "badly-poisoned"
    ) {
      continue;
    }

    const maxHp = calculatePokemonMaxHp(pokemon.pokemon);
    const previousHp = pokemon.currentHp;
    let requestedDamage: number;
    let toxicCounter: number | undefined;

    if (status.type === "badly-poisoned") {
      toxicCounter = clampBadPoisonCounter(status.toxicCounter);
      requestedDamage = Math.max(
        1,
        Math.floor((maxHp * toxicCounter) / BAD_POISON_DAMAGE_DIVISOR),
      );
      status.toxicCounter = Math.min(
        BATTLE_BAD_POISON_MAX_COUNTER,
        toxicCounter + 1,
      );
    } else {
      requestedDamage = Math.max(
        1,
        Math.floor(maxHp / STANDARD_RESIDUAL_DAMAGE_DIVISOR),
      );
    }

    const currentHp = Math.max(0, previousHp - requestedDamage);
    const appliedDamage = previousHp - currentHp;

    pokemon.currentHp = currentHp;

    effects.push({
      type: "status-residual-damage",
      participantId: participant.id,
      pokemonInstanceId: pokemon.pokemon.instanceId,
      status: status.type,
      previousHp,
      currentHp,
      appliedDamage,
      ...(toxicCounter === undefined ? {} : { toxicCounter }),
    });

    if (currentHp === 0) {
      break;
    }
  }

  return effects;
}

function clampBadPoisonCounter(counter: number): number {
  if (!Number.isInteger(counter) || counter <= 0) {
    throw new Error(`Invalid badly-poisoned toxic counter "${counter}"`);
  }

  return Math.min(counter, BATTLE_BAD_POISON_MAX_COUNTER);
}

function assertPositiveBattleStat(name: string, value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid Battle ${name} "${value}"`);
  }
}
