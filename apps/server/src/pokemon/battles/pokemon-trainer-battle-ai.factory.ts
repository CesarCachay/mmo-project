import {
  createBattleCommand,
  getActiveBattlePokemon,
  getBattleParticipantById,
  isBattlePokemonFainted,
  getPokemonTrainerBattleDefinition,
  type BattleCommand,
} from '@cesar-mmo/shared';

import type { PokemonBattleSession } from './pokemon-battle-session';

export type TrainerBattleAiRandomSource = () => number;

export function selectTrainerBattleAiReplacementPokemonIndex(
  session: PokemonBattleSession,
  replacementPokemonIndexes: readonly number[],
): number {
  if (session.battle.type !== 'trainer' || !session.trainerBattle) {
    throw new Error(
      `Battle "${session.battle.battleId}" is not a Trainer Battle session`,
    );
  }

  if (replacementPokemonIndexes.length === 0) {
    throw new Error(
      `Trainer Battle AI has no replacement Pokémon candidates in battle "${session.battle.battleId}"`,
    );
  }

  const opponentParticipant = getBattleParticipantById(
    session.battle,
    session.trainerBattle.opponentParticipantId,
  );

  for (const pokemonIndex of replacementPokemonIndexes) {
    const pokemonState = opponentParticipant.pokemon[pokemonIndex];

    if (
      !Number.isInteger(pokemonIndex) ||
      pokemonIndex < 0 ||
      pokemonIndex === opponentParticipant.activePokemonIndex ||
      !pokemonState ||
      isBattlePokemonFainted(pokemonState)
    ) {
      throw new Error(
        `Trainer Battle AI received invalid replacement candidate "${pokemonIndex}" in battle "${session.battle.battleId}"`,
      );
    }
  }

  const definition = getPokemonTrainerBattleDefinition(
    session.trainerBattle.trainerBattleId,
  );

  switch (definition.aiProfileId) {
    case 'basic': {
      /*
       * Basic AI keeps party order deterministic: choose the first usable
       * roster slot supplied by the authoritative continuation resolver.
       */
      const selectedPokemonIndex = [...replacementPokemonIndexes].sort(
        (left, right) => left - right,
      )[0];

      if (selectedPokemonIndex === undefined) {
        throw new Error(
          `Trainer Battle AI failed to select a replacement in battle "${session.battle.battleId}"`,
        );
      }

      return selectedPokemonIndex;
    }
  }
}

export function createTrainerBattleAiCommand(
  session: PokemonBattleSession,
  random: TrainerBattleAiRandomSource = Math.random,
): BattleCommand {
  if (session.battle.type !== 'trainer' || !session.trainerBattle) {
    throw new Error(
      `Battle "${session.battle.battleId}" is not a Trainer Battle session`,
    );
  }

  const definition = getPokemonTrainerBattleDefinition(
    session.trainerBattle.trainerBattleId,
  );

  switch (definition.aiProfileId) {
    case 'basic':
      return createBasicTrainerBattleAiCommand(
        session,
        session.trainerBattle.opponentParticipantId,
        random,
      );
  }
}

function createBasicTrainerBattleAiCommand(
  session: PokemonBattleSession,
  participantId: string,
  random: TrainerBattleAiRandomSource,
): BattleCommand {
  const participant = session.battle.participants.find(
    (candidate) => candidate.id === participantId,
  );

  if (!participant) {
    throw new Error(
      `Trainer Battle AI participant "${participantId}" not found in battle "${session.battle.battleId}"`,
    );
  }

  const activePokemon = getActiveBattlePokemon(participant);
  const availableMoves = activePokemon.pokemon.moves.filter(
    (move) => move.currentPp > 0,
  );

  if (availableMoves.length === 0) {
    return createBattleCommand(session.battle, {
      participantId,
      action: {
        type: 'struggle',
      },
    });
  }

  const randomValue = random();

  if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
    throw new Error(`Invalid Trainer Battle AI random value "${randomValue}"`);
  }

  const selectedMove =
    availableMoves[Math.floor(randomValue * availableMoves.length)];

  if (!selectedMove) {
    throw new Error(
      `Trainer Battle AI failed to select a move in battle "${session.battle.battleId}"`,
    );
  }

  return createBattleCommand(session.battle, {
    participantId,
    action: {
      type: 'use-move',
      moveId: selectedMove.moveId,
    },
  });
}
