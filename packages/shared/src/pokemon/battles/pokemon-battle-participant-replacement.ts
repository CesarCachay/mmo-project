import { isBattlePokemonFainted } from "./pokemon-battle-faint.js";

import { getActiveBattlePokemon } from "./pokemon-battle-participant.js";

import type {
  BattleParticipant,
  BattleParticipantId,
  BattlePokemonState,
} from "./pokemon-battle.types.js";

export interface BattleTrainerPokemonReplacementResult {
  readonly participantId: BattleParticipantId;
  readonly previousActivePokemonIndex: number;
  readonly currentActivePokemonIndex: number;
  readonly activePokemon: BattlePokemonState;
}

export function replaceFaintedTrainerBattlePokemon(
  participant: BattleParticipant,
  replacementPokemonIndex: number
): BattleTrainerPokemonReplacementResult {
  //
  // This operation currently belongs only
  // to Trainer replacement flow.
  //

  if (participant.type !== "trainer") {
    throw new Error(
      `Participant "${participant.id}" is not a Trainer and cannot use Trainer replacement`
    );
  }

  //
  // Replacement index must be a valid
  // integer roster index.
  //

  if (!Number.isInteger(replacementPokemonIndex) || replacementPokemonIndex < 0) {
    throw new Error(
      `Invalid replacement Pokémon index "${replacementPokemonIndex}" for participant "${participant.id}"`
    );
  }

  const previousActivePokemonIndex = participant.activePokemonIndex;

  //
  // Replacement flow is only valid when
  // the currently active Pokémon fainted.
  //

  const previousActivePokemon = getActiveBattlePokemon(participant);

  if (!isBattlePokemonFainted(previousActivePokemon)) {
    throw new Error(
      `Trainer participant "${participant.id}" cannot replace an active Pokémon that is still able to battle`
    );
  }

  //
  // Selecting the same slot does not
  // constitute a replacement.
  //

  if (replacementPokemonIndex === previousActivePokemonIndex) {
    throw new Error(
      `Replacement Pokémon index "${replacementPokemonIndex}" is already active for participant "${participant.id}"`
    );
  }

  const replacementPokemon = participant.pokemon[replacementPokemonIndex];

  if (!replacementPokemon) {
    throw new Error(
      `Replacement Pokémon index "${replacementPokemonIndex}" does not exist for participant "${participant.id}"`
    );
  }

  //
  // Cannot send another fainted Pokémon.
  //

  if (isBattlePokemonFainted(replacementPokemon)) {
    throw new Error(
      `Replacement Pokémon at index "${replacementPokemonIndex}" is fainted for participant "${participant.id}"`
    );
  }

  participant.activePokemonIndex = replacementPokemonIndex;

  return {
    participantId: participant.id,
    previousActivePokemonIndex,
    currentActivePokemonIndex: participant.activePokemonIndex,
    activePokemon: replacementPokemon,
  };
}
