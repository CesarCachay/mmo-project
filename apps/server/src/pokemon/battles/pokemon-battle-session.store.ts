import type { BattleId } from '@cesar-mmo/shared';
import { completeBattle } from '@cesar-mmo/shared';

import type { PokemonTrainerId } from '../pokemon-trainer-identity';

import { createPokemonBattleSession } from './pokemon-battle-session';
import type {
  CreatePokemonBattleSessionInput,
  PokemonBattleSession,
} from './pokemon-battle-session';

export class PokemonBattleSessionStore {
  private readonly sessionsByBattleId = new Map<
    BattleId,
    PokemonBattleSession
  >();

  private readonly battleIdByTrainerId = new Map<PokemonTrainerId, BattleId>();
  private readonly battleIdByPlayerId = new Map<string, BattleId>();

  create(input: CreatePokemonBattleSessionInput): PokemonBattleSession {
    const session = createPokemonBattleSession(input);
    const battleId = session.battle.battleId;

    if (this.sessionsByBattleId.has(battleId)) {
      throw new Error(`Battle session "${battleId}" already exists`);
    }

    for (const binding of session.trainerBindings) {
      const existingTrainerBattleId = this.battleIdByTrainerId.get(
        binding.trainerId,
      );

      if (existingTrainerBattleId) {
        throw new Error(
          `Trainer "${binding.trainerId}" already has active battle "${existingTrainerBattleId}"`,
        );
      }

      const existingPlayerBattleId = this.battleIdByPlayerId.get(
        binding.playerId,
      );

      if (existingPlayerBattleId) {
        throw new Error(
          `Player "${binding.playerId}" already has active battle "${existingPlayerBattleId}"`,
        );
      }
    }

    this.sessionsByBattleId.set(battleId, session);

    for (const binding of session.trainerBindings) {
      this.battleIdByTrainerId.set(binding.trainerId, battleId);
      this.battleIdByPlayerId.set(binding.playerId, battleId);
    }

    return session;
  }

  complete(battleId: BattleId): PokemonBattleSession {
    const session = this.sessionsByBattleId.get(battleId);

    if (!session) {
      throw new Error(`Battle session "${battleId}" not found`);
    }

    const completedBattle = completeBattle(session.battle);

    const completedSession: PokemonBattleSession = {
      ...session,
      battle: completedBattle,
    };

    //
    // Replace the active BattleInstance
    // with its completed immutable version.
    //

    this.sessionsByBattleId.set(battleId, completedSession);

    //
    // A completed battle no longer occupies
    // the trainer/player active-battle indexes.
    //

    for (const binding of completedSession.trainerBindings) {
      if (this.battleIdByTrainerId.get(binding.trainerId) === battleId) {
        this.battleIdByTrainerId.delete(binding.trainerId);
      }

      if (this.battleIdByPlayerId.get(binding.playerId) === battleId) {
        this.battleIdByPlayerId.delete(binding.playerId);
      }
    }

    return completedSession;
  }

  

  getByBattleId(battleId: BattleId): PokemonBattleSession | undefined {
    return this.sessionsByBattleId.get(battleId);
  }

  getByTrainerId(
    trainerId: PokemonTrainerId,
  ): PokemonBattleSession | undefined {
    const battleId = this.battleIdByTrainerId.get(trainerId);

    if (!battleId) {
      return undefined;
    }

    return this.sessionsByBattleId.get(battleId);
  }

  getByPlayerId(playerId: string): PokemonBattleSession | undefined {
    const battleId = this.battleIdByPlayerId.get(playerId);

    if (!battleId) {
      return undefined;
    }

    return this.sessionsByBattleId.get(battleId);
  }

  hasBattle(battleId: BattleId): boolean {
    return this.sessionsByBattleId.has(battleId);
  }

  hasTrainerBattle(trainerId: PokemonTrainerId): boolean {
    return this.battleIdByTrainerId.has(trainerId);
  }

  hasPlayerBattle(playerId: string): boolean {
    return this.battleIdByPlayerId.has(playerId);
  }

  remove(battleId: BattleId): void {
    const session = this.sessionsByBattleId.get(battleId);

    if (!session) {
      return;
    }

    this.sessionsByBattleId.delete(battleId);

    for (const binding of session.trainerBindings) {
      if (this.battleIdByTrainerId.get(binding.trainerId) === battleId) {
        this.battleIdByTrainerId.delete(binding.trainerId);
      }

      if (this.battleIdByPlayerId.get(binding.playerId) === battleId) {
        this.battleIdByPlayerId.delete(binding.playerId);
      }
    }
  }

  clear(): void {
    this.sessionsByBattleId.clear();
    this.battleIdByTrainerId.clear();
    this.battleIdByPlayerId.clear();
  }
}
