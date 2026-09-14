import { Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';

import type {
  AccountId,
  AccountProvider,
  AccountRecord,
  CreateAccountInput,
} from './account.types';

@Injectable()
export class AccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(accountId: AccountId): Promise<AccountRecord | undefined> {
    const account = await this.prisma.account.findUnique({
      where: {
        id: accountId,
      },
    });

    if (!account) {
      return undefined;
    }

    return this.toRecord(account);
  }

  async findByProviderIdentity(
    provider: AccountProvider,
    providerUserId: string,
  ): Promise<AccountRecord | undefined> {
    const account = await this.prisma.account.findUnique({
      where: {
        provider_providerUserId: {
          provider,
          providerUserId,
        },
      },
    });

    if (!account) {
      return undefined;
    }

    return this.toRecord(account);
  }

  async create(input: CreateAccountInput): Promise<AccountRecord> {
    const account = await this.prisma.account.create({
      data: {
        provider: input.provider,
        providerUserId: input.providerUserId,
        email: input.email ?? null,
      },
    });

    return this.toRecord(account);
  }

  async upsertByProviderIdentity(
    input: CreateAccountInput,
  ): Promise<AccountRecord> {
    const account = await this.prisma.account.upsert({
      where: {
        provider_providerUserId: {
          provider: input.provider,
          providerUserId: input.providerUserId,
        },
      },

      create: {
        provider: input.provider,
        providerUserId: input.providerUserId,
        email: input.email ?? null,
      },

      update:
        input.email === undefined
          ? {}
          : {
              email: input.email,
            },
    });

    return this.toRecord(account);
  }

  private toRecord(account: {
    id: string;
    provider: AccountProvider;
    providerUserId: string;
    email: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): AccountRecord {
    return {
      accountId: account.id,
      provider: account.provider,
      providerUserId: account.providerUserId,
      email: account.email,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }
}
