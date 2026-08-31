import { isBattlePokemonFainted } from "./pokemon-battle-faint.js";

import type { BattleParticipant } from "./pokemon-battle.types.js";

export function getBattleParticipantUsablePokemonIndexes(
  participant: BattleParticipant
): readonly number[] {
  const usableIndexes: number[] = [];

  participant.pokemon.forEach((pokemon, index) => {
    if (!isBattlePokemonFainted(pokemon)) {
      usableIndexes.push(index);
    }
  });

  return usableIndexes;
}

export function getBattleParticipantReplacementPokemonIndexes(
  participant: BattleParticipant
): readonly number[] {
  return getBattleParticipantUsablePokemonIndexes(participant).filter(
    (index) => index !== participant.activePokemonIndex
  );
}

export function hasBattleParticipantUsablePokemon(
  participant: BattleParticipant
): boolean {
  return getBattleParticipantUsablePokemonIndexes(participant).length > 0;
}

export function isBattleParticipantDefeated(participant: BattleParticipant): boolean {
  return !hasBattleParticipantUsablePokemon(participant);
}
