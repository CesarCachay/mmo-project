import { Injectable } from '@nestjs/common';

import type { PokemonTrainerId } from '#app/pokemon/pokemon-trainer-identity';

export class TrainerAlreadyConnectedError extends Error {
  readonly trainerId: PokemonTrainerId;

  constructor(trainerId: PokemonTrainerId) {
    super(`Trainer "${trainerId}" is already connected`);
    this.name = 'TrainerAlreadyConnectedError';
    this.trainerId = trainerId;
  }
}

@Injectable()
export class TrainerConnectionStore {
  private readonly trainerIdByPlayerId = new Map<string, PokemonTrainerId>();
  private readonly playerIdByTrainerId = new Map<PokemonTrainerId, string>();

  bind(playerId: string, trainerId: PokemonTrainerId): void {
    const normalizedPlayerId = playerId.trim();

    if (!normalizedPlayerId) {
      throw new Error('Player id is required');
    }

    const existingTrainerId = this.trainerIdByPlayerId.get(normalizedPlayerId);

    if (existingTrainerId) {
      throw new Error(`Player "${normalizedPlayerId}" already has a Trainer`);
    }

    const activePlayerId = this.playerIdByTrainerId.get(trainerId);

    if (activePlayerId && activePlayerId !== normalizedPlayerId) {
      throw new TrainerAlreadyConnectedError(trainerId);
    }

    this.trainerIdByPlayerId.set(normalizedPlayerId, trainerId);
    this.playerIdByTrainerId.set(trainerId, normalizedPlayerId);
  }

  getTrainerId(playerId: string): PokemonTrainerId | undefined {
    return this.trainerIdByPlayerId.get(playerId);
  }

  unbind(playerId: string): void {
    const trainerId = this.trainerIdByPlayerId.get(playerId);

    if (!trainerId) {
      return;
    }

    this.trainerIdByPlayerId.delete(playerId);

    const activePlayerId = this.playerIdByTrainerId.get(trainerId);

    if (activePlayerId === playerId) {
      this.playerIdByTrainerId.delete(trainerId);
    }
  }

  clear(): void {
    this.trainerIdByPlayerId.clear();
    this.playerIdByTrainerId.clear();
  }
}
