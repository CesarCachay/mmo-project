import { resolveWildBattleContinuationOutcome } from '@cesar-mmo/shared';

import type { PokemonBattleSession } from './pokemon-battle-session.js';

export interface AssertPokemonTrainerBattleSwitchAllowedInput {
  readonly session: PokemonBattleSession;
  readonly playerId: string;
  readonly pokemonIndex: number;
}

export interface PokemonTrainerBattleSwitchValidationResult {
  readonly participantId: string;
  readonly pokemonIndex: number;
  readonly pokemonInstanceId: string;
}

export function assertPokemonTrainerBattleSwitchAllowed(
  input: AssertPokemonTrainerBattleSwitchAllowedInput,
): PokemonTrainerBattleSwitchValidationResult {
  const { session, playerId, pokemonIndex } = input;

  const battle = session.battle;

  /* 1. Battle must still be active. */
  if (battle.status !== 'active') {
    throw new Error(
      `Cannot switch Pokémon in battle "${battle.battleId}" with status "${battle.status}"`,
    );
  }

  /*
   * 2. Resolve authoritative Trainer binding.
   * Browser never chooses participantId.
   */
  const trainerBinding = session.trainerBindings.find(
    (binding) => binding.playerId === playerId,
  );

  if (!trainerBinding) {
    throw new Error(
      `Player "${playerId}" is not bound to battle "${battle.battleId}"`,
    );
  }

  /*
   * 3. Voluntary switching is only valid during
   * normal Battle continuation.
   *
   * In particular:
   * - not after Trainer faint
   * - not after defeat
   * - not after Wild defeat
   */
  const continuation = resolveWildBattleContinuationOutcome(battle);

  if (continuation.type !== 'continue') {
    throw new Error(
      `Voluntary Pokémon switch is not allowed while battle "${battle.battleId}" continuation is "${continuation.type}"`,
    );
  }

  /* 4. Resolve authoritative Trainer participant. */
  const trainerParticipant = battle.participants.find(
    (participant) => participant.id === trainerBinding.participantId,
  );

  if (!trainerParticipant) {
    throw new Error(
      `Trainer participant "${trainerBinding.participantId}" not found in battle "${battle.battleId}"`,
    );
  }

  if (trainerParticipant.type !== 'trainer') {
    throw new Error(
      `Battle participant "${trainerParticipant.id}" is not a Trainer`,
    );
  }

  /* 5. pokemonIndex must be inside the authoritative Battle party snapshot. */
  if (
    !Number.isInteger(pokemonIndex) ||
    pokemonIndex < 0 ||
    pokemonIndex >= trainerParticipant.pokemon.length
  ) {
    throw new Error(
      `Pokémon index "${pokemonIndex}" is outside Trainer party for battle "${battle.battleId}"`,
    );
  }

  /* 6. Cannot voluntarily switch to current active. */
  if (pokemonIndex === trainerParticipant.activePokemonIndex) {
    throw new Error(
      `Pokémon index "${pokemonIndex}" is already active in battle "${battle.battleId}"`,
    );
  }

  const candidate = trainerParticipant.pokemon[pokemonIndex];

  if (!candidate) {
    throw new Error(
      `Pokémon index "${pokemonIndex}" not found in battle "${battle.battleId}"`,
    );
  }

  /*
   * 7. Candidate must be able to battle.
   * IMPORTANT:
   * use BattlePokemonState.currentHp,
   * not PokemonInstance.currentHp.
   */
  if (candidate.currentHp <= 0) {
    throw new Error(
      `Pokémon "${candidate.pokemon.instanceId}" is fainted and cannot be switched into battle`,
    );
  }

  // 8. Voluntary switch means the current active must still be able to act.

  const activePokemon =
    trainerParticipant.pokemon[trainerParticipant.activePokemonIndex];

  if (!activePokemon) {
    throw new Error(
      `Active Pokémon not found for Trainer participant "${trainerParticipant.id}"`,
    );
  }

  if (activePokemon.currentHp <= 0) {
    throw new Error(
      `Trainer active Pokémon is fainted; battle "${battle.battleId}" requires forced replacement instead of voluntary switch`,
    );
  }

  return {
    participantId: trainerParticipant.id,
    pokemonIndex,
    pokemonInstanceId: candidate.pokemon.instanceId,
  };
}
