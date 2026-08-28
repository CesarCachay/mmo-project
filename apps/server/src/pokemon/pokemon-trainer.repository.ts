import { Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';

import type {
  PokemonTrainerIdentity,
  PokemonTrainerId,
  PokemonTrainerSessionToken,
} from './pokemon-trainer-identity';

import type { PokemonTrainerRecord } from './pokemon-trainer.repository.types';

import { hashPokemonTrainerSessionToken } from './pokemon-trainer-session-token';

@Injectable()
export class PokemonTrainerRepository {
  private readonly prisma: PrismaService;

  constructor(prisma: PrismaService) {
    this.prisma = prisma;
  }

  async create(
    identity: PokemonTrainerIdentity,
  ): Promise<PokemonTrainerRecord> {
    const sessionTokenHash = hashPokemonTrainerSessionToken(
      identity.sessionToken,
    );

    const trainer = await this.prisma.pokemonTrainer.create({
      data: {
        id: identity.trainerId,
        sessionTokenHash,
      },
    });

    return {
      trainerId: trainer.id,
      createdAt: trainer.createdAt,
      updatedAt: trainer.updatedAt,
    };
  }

  async findByTrainerId(
    trainerId: PokemonTrainerId,
  ): Promise<PokemonTrainerRecord | undefined> {
    const trainer = await this.prisma.pokemonTrainer.findUnique({
      where: {
        id: trainerId,
      },
    });

    if (!trainer) {
      return undefined;
    }

    return {
      trainerId: trainer.id,
      createdAt: trainer.createdAt,
      updatedAt: trainer.updatedAt,
    };
  }

  async findBySessionToken(
    sessionToken: PokemonTrainerSessionToken,
  ): Promise<PokemonTrainerRecord | undefined> {
    const sessionTokenHash = hashPokemonTrainerSessionToken(sessionToken);

    const trainer = await this.prisma.pokemonTrainer.findUnique({
      where: {
        sessionTokenHash,
      },
    });

    if (!trainer) {
      return undefined;
    }

    return {
      trainerId: trainer.id,
      createdAt: trainer.createdAt,
      updatedAt: trainer.updatedAt,
    };
  }
}
