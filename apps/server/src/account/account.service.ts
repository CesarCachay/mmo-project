import { Injectable } from '@nestjs/common';

import { AccountRepository } from './account.repository';

import type {
  AccountId,
  AccountRecord,
  ResolveAccountInput,
} from './account.types';

@Injectable()
export class AccountService {
  constructor(private readonly accountRepository: AccountRepository) {}

  async findById(accountId: AccountId): Promise<AccountRecord | undefined> {
    return this.accountRepository.findById(accountId);
  }

  async resolveProviderAccount(
    input: ResolveAccountInput,
  ): Promise<AccountRecord> {
    const providerUserId = input.providerUserId.trim();

    if (!providerUserId) {
      throw new Error('Account provider user id is required');
    }

    const email = this.normalizeEmail(input.email);

    return this.accountRepository.upsertByProviderIdentity({
      provider: input.provider,
      providerUserId,

      ...(email !== undefined
        ? {
            email,
          }
        : {}),
    });
  }

  private normalizeEmail(
    email: string | null | undefined,
  ): string | null | undefined {
    if (email === undefined) {
      return undefined;
    }

    if (email === null) {
      return null;
    }

    const normalizedEmail = email.trim().toLowerCase();

    return normalizedEmail || null;
  }
}
