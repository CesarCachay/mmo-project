import {
  resolveWildBattleContinuationOutcome,
  type BattleTurnResolutionEntry,
} from '@cesar-mmo/shared';

import type { PokemonBattleSession } from './pokemon-battle-session.js';

export interface ApplyPokemonTrainerBattleSwitchInput {
  readonly session: PokemonBattleSession;
  readonly entry: BattleTurnResolutionEntry;
}

export interface PokemonTrainerBattleSwitchRuntimeResult {
  readonly battleId: string;
  readonly participantId: string;

  readonly previousActivePokemonIndex: number;
  readonly currentActivePokemonIndex: number;

  readonly previousPokemonInstanceId: string;
  readonly activePokemonInstanceId: string;
}

export function applyPokemonTrainerBattleSwitch(
  input: ApplyPokemonTrainerBattleSwitchInput,
): PokemonTrainerBattleSwitchRuntimeResult {
  const { session, entry } = input;

  const battle = session.battle;
  const action = entry.command.action;

  /*
   * This runtime executes only voluntary switch
   * BattleTurn entries.
   */
  if (action.type !== 'switch-pokemon') {
    throw new Error(
      `Cannot execute Battle action "${action.type}" as Trainer Pokémon switch`,
    );
  }

  /*
   * Battle must still be active.
   */
  if (battle.status !== 'active') {
    throw new Error(
      `Cannot switch Pokémon in battle "${battle.battleId}" with status "${battle.status}"`,
    );
  }

  /*
   * Voluntary switch belongs only to normal
   * battle continuation.
   *
   * Forced replacement remains independent.
   */
  const continuation = resolveWildBattleContinuationOutcome(battle);

  if (continuation.type !== 'continue') {
    throw new Error(
      `Cannot execute voluntary Pokémon switch while battle "${battle.battleId}" continuation is "${continuation.type}"`,
    );
  }

  /*
   * Resolve authoritative participant from
   * the BattleCommand.
   */
  const trainerParticipant = battle.participants.find(
    (participant) => participant.id === entry.command.participantId,
  );

  if (!trainerParticipant) {
    throw new Error(
      `Battle participant "${entry.command.participantId}" not found in battle "${battle.battleId}"`,
    );
  }

  if (trainerParticipant.type !== 'trainer') {
    throw new Error(
      `Battle participant "${trainerParticipant.id}" cannot execute Trainer Pokémon switch`,
    );
  }

  const pokemonIndex = action.pokemonIndex;

  /*
   * Defensive execution-time validation.
   *
   * Step 3 already validates at command intake,
   * but execution should still protect its own
   * invariants.
   */
  if (
    !Number.isInteger(pokemonIndex) ||
    pokemonIndex < 0 ||
    pokemonIndex >= trainerParticipant.pokemon.length
  ) {
    throw new Error(
      `Pokémon index "${pokemonIndex}" is outside Trainer party for battle "${battle.battleId}"`,
    );
  }

  const previousActivePokemonIndex = trainerParticipant.activePokemonIndex;

  if (pokemonIndex === previousActivePokemonIndex) {
    throw new Error(
      `Pokémon index "${pokemonIndex}" is already active in battle "${battle.battleId}"`,
    );
  }

  const previousPokemon =
    trainerParticipant.pokemon[previousActivePokemonIndex];

  if (!previousPokemon) {
    throw new Error(
      `Active Pokémon not found for Trainer participant "${trainerParticipant.id}"`,
    );
  }

  /*
   * A fainted active Pokémon belongs to
   * forced replacement, never voluntary switch.
   */
  if (previousPokemon.currentHp <= 0) {
    throw new Error(
      `Trainer active Pokémon is fainted in battle "${battle.battleId}"; forced replacement is required`,
    );
  }

  const nextPokemon = trainerParticipant.pokemon[pokemonIndex];

  if (!nextPokemon) {
    throw new Error(
      `Pokémon index "${pokemonIndex}" not found in battle "${battle.battleId}"`,
    );
  }

  if (nextPokemon.currentHp <= 0) {
    throw new Error(
      `Pokémon "${nextPokemon.pokemon.instanceId}" is fainted and cannot enter battle`,
    );
  }

  /*
   * Authoritative Battle mutation.
   *
   * No persistence happens here.
   * This is Battle runtime state only.
   */
  trainerParticipant.activePokemonIndex = pokemonIndex;

  return {
    battleId: battle.battleId,
    participantId: trainerParticipant.id,
    previousActivePokemonIndex,
    currentActivePokemonIndex: trainerParticipant.activePokemonIndex,
    previousPokemonInstanceId: previousPokemon.pokemon.instanceId,
    activePokemonInstanceId: nextPokemon.pokemon.instanceId,
  };
}
