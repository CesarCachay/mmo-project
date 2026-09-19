import type {
  BattleInstance,
  BattleParticipantId,
  PokemonTrainerBattleId,
} from '@cesar-mmo/shared';

import type { PokemonTrainerId } from '../pokemon-trainer-identity';

export interface PokemonBattleTrainerBindingInput {
  readonly participantId: BattleParticipantId;
  readonly trainerId: PokemonTrainerId;
  readonly playerId: string;
}

export interface PokemonBattleTrainerBinding extends PokemonBattleTrainerBindingInput {
  readonly participatingPokemonInstanceIds: Set<string>;
}

export interface PokemonTrainerBattleSessionContext {
  readonly npcId: string;
  readonly trainerBattleId: PokemonTrainerBattleId;
  readonly opponentParticipantId: BattleParticipantId;
}

export interface PokemonBattleSession {
  readonly battle: BattleInstance;
  readonly trainerBindings: readonly PokemonBattleTrainerBinding[];
  readonly trainerBattle?: PokemonTrainerBattleSessionContext;
}

export interface CreatePokemonBattleSessionInput {
  readonly battle: BattleInstance;
  readonly trainerBindings: readonly PokemonBattleTrainerBindingInput[];
  readonly trainerBattle?: PokemonTrainerBattleSessionContext;
}

export function createPokemonBattleSession(
  input: CreatePokemonBattleSessionInput,
): PokemonBattleSession {
  const { battle, trainerBindings, trainerBattle } = input;

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
  const normalizedBindings: PokemonBattleTrainerBinding[] = [];

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

    const activePokemon = participant.pokemon[participant.activePokemonIndex];

    if (!activePokemon) {
      throw new Error(
        `Trainer participant "${participant.id}" has no active Pokémon in battle "${battle.battleId}"`,
      );
    }

    participantIds.add(binding.participantId);
    trainerIds.add(binding.trainerId);
    playerIds.add(binding.playerId);
    normalizedBindings.push({
      ...binding,
      participatingPokemonInstanceIds: new Set([
        activePokemon.pokemon.instanceId,
      ]),
    });
  }

  if (battle.type === 'trainer') {
    if (!trainerBattle) {
      throw new Error(
        `Trainer Battle "${battle.battleId}" requires Trainer Battle session context`,
      );
    }

    const opponentParticipant = battle.participants.find(
      (participant) => participant.id === trainerBattle.opponentParticipantId,
    );

    if (!opponentParticipant || opponentParticipant.type !== 'trainer') {
      throw new Error(
        `Trainer Battle opponent participant "${trainerBattle.opponentParticipantId}" not found in battle "${battle.battleId}"`,
      );
    }

    if (normalizedBindings.some(
      (binding) => binding.participantId === opponentParticipant.id,
    )) {
      throw new Error(
        `Trainer Battle opponent participant "${opponentParticipant.id}" cannot be player-bound`,
      );
    }
  } else if (trainerBattle) {
    throw new Error(
      `Wild Battle "${battle.battleId}" cannot contain Trainer Battle session context`,
    );
  }

  return {
    battle,
    trainerBindings: normalizedBindings,
    ...(trainerBattle ? { trainerBattle } : {}),
  };
}

/* Mark a Pokémon as having participated in this Battle */
export function markPokemonBattleParticipation(
  session: PokemonBattleSession,
  participantId: BattleParticipantId,
  pokemonInstanceId: string,
): void {
  const binding = session.trainerBindings.find(
    (candidate) => candidate.participantId === participantId,
  );

  if (!binding) {
    throw new Error(
      `Trainer participant "${participantId}" is not bound to battle "${session.battle.battleId}"`,
    );
  }

  const participant = session.battle.participants.find(
    (candidate) => candidate.id === participantId,
  );

  if (!participant || participant.type !== 'trainer') {
    throw new Error(
      `Trainer participant "${participantId}" not found in battle "${session.battle.battleId}"`,
    );
  }

  const belongsToParticipant = participant.pokemon.some(
    (pokemonState) => pokemonState.pokemon.instanceId === pokemonInstanceId,
  );

  if (!belongsToParticipant) {
    throw new Error(
      `Pokémon "${pokemonInstanceId}" does not belong to Trainer participant "${participantId}"`,
    );
  }

  binding.participatingPokemonInstanceIds.add(pokemonInstanceId);
}

export function getPokemonBattleParticipatingPokemonInstanceIds(
  session: PokemonBattleSession,

  participantId: BattleParticipantId,
): readonly string[] {
  const binding = session.trainerBindings.find(
    (candidate) => candidate.participantId === participantId,
  );

  if (!binding) {
    throw new Error(
      `Trainer participant "${participantId}" is not bound to battle "${session.battle.battleId}"`,
    );
  }

  return [...binding.participatingPokemonInstanceIds];
}
