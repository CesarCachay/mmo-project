import { Injectable } from '@nestjs/common';

import { PrismaService } from '#app/database/prisma.service';

import type { AccountId } from '../account.types';

import type {
  AccountPasswordCredentialRecord,
  CreateAccountPasswordCredentialInput,
} from './account-password.types';

@Injectable()
export class AccountPasswordCredentialRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByAccountId(
    accountId: AccountId,
  ): Promise<AccountPasswordCredentialRecord | undefined> {
    const credential = await this.prisma.accountPasswordCredential.findUnique({
      where: {
        accountId,
      },
    });

    if (!credential) {
      return undefined;
    }

    return this.toRecord(credential);
  }

  async create(
    input: CreateAccountPasswordCredentialInput,
  ): Promise<AccountPasswordCredentialRecord> {
    const credential = await this.prisma.accountPasswordCredential.create({
      data: {
        accountId: input.accountId,
        passwordHash: input.passwordHash,
      },
    });

    return this.toRecord(credential);
  }

  private toRecord(credential: {
    accountId: string;
    passwordHash: string;
    createdAt: Date;
    updatedAt: Date;
  }): AccountPasswordCredentialRecord {
    return {
      accountId: credential.accountId,
      passwordHash: credential.passwordHash,
      createdAt: credential.createdAt,
      updatedAt: credential.updatedAt,
    };
  }
}
