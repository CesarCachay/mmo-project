import { Injectable } from '@nestjs/common';

import { PrismaService } from '#app/database/prisma.service';

import type { PokemonTrainerId } from '#app/pokemon/pokemon-trainer-identity';

import type {
  PersistedPlayerWorldLocation,
  PlayerWorldLocation,
} from './player-world.types';

@Injectable()
export class PlayerWorldLocationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async load(
    trainerId: PokemonTrainerId,
  ): Promise<PersistedPlayerWorldLocation | undefined> {
    const trainer = await this.prisma.pokemonTrainer.findUnique({
      where: {
        id: trainerId,
      },
      select: {
        worldMapId: true,
        worldX: true,
        worldY: true,
        worldDirection: true,
      },
    });

    if (!trainer) {
      return undefined;
    }

    return {
      mapId: trainer.worldMapId,
      x: trainer.worldX,
      y: trainer.worldY,
      direction: trainer.worldDirection,
    };
  }

  async save(
    trainerId: PokemonTrainerId,
    location: PlayerWorldLocation,
  ): Promise<void> {
    await this.prisma.pokemonTrainer.update({
      where: {
        id: trainerId,
      },
      data: {
        worldMapId: location.mapId,
        worldX: location.x,
        worldY: location.y,
        worldDirection: location.direction,
      },
    });
  }
}
