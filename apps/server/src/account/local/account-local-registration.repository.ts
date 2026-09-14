import { Injectable } from '@nestjs/common';

import { Prisma } from '#app/generated/prisma/client';

import { PrismaService } from '#app/database/prisma.service';

import type {
  CreateLocalAccountPersistenceInput,
  LocalAccountRecord,
} from './account-local-auth.types';

import { LocalAccountRegistrationError } from './account-local-auth.errors';

@Injectable()
export class AccountLocalRegistrationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    input: CreateLocalAccountPersistenceInput,
  ): Promise<LocalAccountRecord> {
    try {
      const account = await this.prisma.account.create({
        data: {
          provider: 'LOCAL',
          providerUserId: input.loginId,
          email: null,
          passwordCredential: {
            create: {
              passwordHash: input.passwordHash,
            },
          },
        },
      });

      return {
        accountId: account.id,
        provider: 'LOCAL',
        providerUserId: account.providerUserId,
        email: account.email,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new LocalAccountRegistrationError(
          'ACCOUNT_ALREADY_EXISTS',
          'An Account with this login id already exists',
        );
      }

      throw error;
    }
  }
}
