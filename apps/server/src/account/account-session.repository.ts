import { Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';

import type { AccountId } from './account.types';

import type { AccountSessionRecord } from './account-session.types';

interface CreateAccountSessionPersistenceInput {
  readonly accountId: AccountId;
  readonly tokenHash: string;
  readonly expiresAt: Date;
}

@Injectable()
export class AccountSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    input: CreateAccountSessionPersistenceInput,
  ): Promise<AccountSessionRecord> {
    const session = await this.prisma.accountSession.create({
      data: {
        accountId: input.accountId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      },
    });

    return this.toRecord(session);
  }

  async findByTokenHash(
    tokenHash: string,
  ): Promise<AccountSessionRecord | undefined> {
    const session = await this.prisma.accountSession.findUnique({
      where: {
        tokenHash,
      },
    });

    if (!session) {
      return undefined;
    }

    return this.toRecord(session);
  }

  async revokeByTokenHash(
    tokenHash: string,
    revokedAt: Date,
  ): Promise<boolean> {
    const result = await this.prisma.accountSession.updateMany({
      where: {
        tokenHash,
        revokedAt: null,
      },

      data: {
        revokedAt,
      },
    });

    return result.count === 1;
  }

  private toRecord(session: {
    id: string;
    accountId: string;
    expiresAt: Date;
    revokedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): AccountSessionRecord {
    return {
      sessionId: session.id,
      accountId: session.accountId,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }
}
