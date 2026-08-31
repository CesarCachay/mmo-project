import type { BattleInstance, BattleParticipantId } from '@cesar-mmo/shared';

import type { PokemonTrainerId } from '../pokemon-trainer-identity';

export interface PokemonBattleTrainerBinding {
  readonly participantId: BattleParticipantId;
  readonly trainerId: PokemonTrainerId;
  readonly playerId: string;
}

export interface PokemonBattleSession {
  readonly battle: BattleInstance;
  readonly trainerBindings: readonly PokemonBattleTrainerBinding[];
}

export interface CreatePokemonBattleSessionInput {
  readonly battle: BattleInstance;
  readonly trainerBindings: readonly PokemonBattleTrainerBinding[];
}

export function createPokemonBattleSession(
  input: CreatePokemonBattleSessionInput,
): PokemonBattleSession {
  const { battle, trainerBindings } = input;

  if (battle.battleId.trim().length === 0) {
    throw new Error('Cannot create battle session with an empty battleId');
  }

  if (trainerBindings.length === 0) {
    throw new Error(
      `Battle "${battle.battleId}" must contain at least one trainer binding`,
    );
  }

  const participantIds = new Set<BattleParticipantId>();
  const trainerIds = new Set<PokemonTrainerId>();
  const playerIds = new Set<string>();

  for (const binding of trainerBindings) {
    if (binding.playerId.trim().length === 0) {
      throw new Error(`Battle "${battle.battleId}" contains an empty playerId`);
    }

    if (participantIds.has(binding.participantId)) {
      throw new Error(
        `Battle "${battle.battleId}" contains duplicate participant binding "${binding.participantId}"`,
      );
    }

    if (trainerIds.has(binding.trainerId)) {
      throw new Error(
        `Battle "${battle.battleId}" contains duplicate trainer binding "${binding.trainerId}"`,
      );
    }

    if (playerIds.has(binding.playerId)) {
      throw new Error(
        `Battle "${battle.battleId}" contains duplicate player binding "${binding.playerId}"`,
      );
    }

    const participant = battle.participants.find(
      (candidate) => candidate.id === binding.participantId,
    );

    if (!participant) {
      throw new Error(
        `Battle participant "${binding.participantId}" does not exist in battle "${battle.battleId}"`,
      );
    }

    if (participant.type !== 'trainer') {
      throw new Error(
        `Battle participant "${binding.participantId}" is not a trainer participant`,
      );
    }

    participantIds.add(binding.participantId);
    trainerIds.add(binding.trainerId);
    playerIds.add(binding.playerId);
  }

  return {
    battle,

    trainerBindings: trainerBindings.map((binding) => ({
      ...binding,
    })),
  };
}
