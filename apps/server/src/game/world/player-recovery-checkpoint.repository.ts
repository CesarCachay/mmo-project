import { Injectable } from '@nestjs/common';

import { PrismaService } from '#app/database/prisma.service';

import type { PokemonTrainerId } from '#app/pokemon/pokemon-trainer-identity';

import type {
  PersistedPlayerRecoveryCheckpoint,
  PlayerRecoveryCheckpoint,
} from './player-world.types';

@Injectable()
export class PlayerRecoveryCheckpointRepository {
  constructor(private readonly prisma: PrismaService) {}

  async load(
    trainerId: PokemonTrainerId,
  ): Promise<PersistedPlayerRecoveryCheckpoint | undefined> {
    const trainer = await this.prisma.pokemonTrainer.findUnique({
      where: {
        id: trainerId,
      },
      select: {
        recoveryMapId: true,
        recoveryX: true,
        recoveryY: true,
        recoveryDirection: true,
      },
    });

    if (!trainer) {
      return undefined;
    }

    return {
      mapId: trainer.recoveryMapId,
      x: trainer.recoveryX,
      y: trainer.recoveryY,
      direction: trainer.recoveryDirection,
    };
  }

  async save(
    trainerId: PokemonTrainerId,
    checkpoint: PlayerRecoveryCheckpoint,
  ): Promise<void> {
    await this.prisma.pokemonTrainer.update({
      where: {
        id: trainerId,
      },
      data: {
        recoveryMapId: checkpoint.mapId,
        recoveryX: checkpoint.x,
        recoveryY: checkpoint.y,
        recoveryDirection: checkpoint.direction,
      },
    });
  }
}
