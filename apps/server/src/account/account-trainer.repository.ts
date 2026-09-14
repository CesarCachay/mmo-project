import { Injectable } from '@nestjs/common';
import { isPlayerAvatarId, type PlayerAvatarId } from '@cesar-mmo/shared';
import { PrismaService } from '../database/prisma.service';

import type { PokemonTrainerId } from '../pokemon/pokemon-trainer-identity';

import { MAX_TRAINERS_PER_ACCOUNT } from './account-trainer.constants';

import { AccountTrainerLimitError } from './account-trainer.errors';

import type { AccountId } from './account.types';

import type { AccountTrainerRecord } from './account-trainer.types';

interface CreateOwnedTrainerPersistenceInput {
  readonly trainerId: PokemonTrainerId;
  readonly accountId: AccountId;
  readonly displayName: string;
  readonly avatarId: PlayerAvatarId;
}

@Injectable()
export class AccountTrainerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByAccountId(
    accountId: AccountId,
  ): Promise<readonly AccountTrainerRecord[]> {
    const trainers = await this.prisma.pokemonTrainer.findMany({
      where: {
        accountId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return trainers.map((trainer) => this.toOwnedRecord(trainer));
  }

  async belongsToAccount(
    accountId: AccountId,
    trainerId: PokemonTrainerId,
  ): Promise<boolean> {
    const trainer = await this.prisma.pokemonTrainer.findFirst({
      where: {
        id: trainerId,
        accountId,
      },

      select: {
        id: true,
      },
    });

    return trainer !== null;
  }

  private toOwnedRecord(trainer: {
    id: string;
    accountId: string;
    displayName: string;
    avatarId: string;
    createdAt: Date;
    updatedAt: Date;
  }): AccountTrainerRecord {
    if (!isPlayerAvatarId(trainer.avatarId)) {
      throw new Error(
        `Trainer "${trainer.id}" contains invalid persisted avatarId "${trainer.avatarId}"`,
      );
    }

    return {
      trainerId: trainer.id,
      accountId: trainer.accountId,
      displayName: trainer.displayName,
      avatarId: trainer.avatarId,
      createdAt: trainer.createdAt,
      updatedAt: trainer.updatedAt,
    };
  }

  async createOwnedTrainer(
    input: CreateOwnedTrainerPersistenceInput,
  ): Promise<AccountTrainerRecord> {
    return this.prisma.$transaction(async (tx) => {
      const accountRows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "accounts"
      WHERE "id" = CAST(${input.accountId} AS uuid)
      FOR UPDATE
    `;

      if (accountRows.length === 0) {
        throw new Error(`Account "${input.accountId}" does not exist`);
      }

      const trainerCount = await tx.pokemonTrainer.count({
        where: {
          accountId: input.accountId,
        },
      });

      if (trainerCount >= MAX_TRAINERS_PER_ACCOUNT) {
        throw new AccountTrainerLimitError();
      }

      const trainer = await tx.pokemonTrainer.create({
        data: {
          id: input.trainerId,
          accountId: input.accountId,
          displayName: input.displayName,
          avatarId: input.avatarId,
        },
      });

      return this.toOwnedRecord(trainer);
    });
  }
}
