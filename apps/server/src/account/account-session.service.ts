import { Injectable } from '@nestjs/common';

import { AccountRepository } from './account.repository';
import { AccountSessionRepository } from './account-session.repository';

import { ACCOUNT_SESSION_TTL_MS } from './account-session.constants';

import {
  createAccountSessionToken,
  hashAccountSessionToken,
  isAccountSessionToken,
} from './account-session-token';

import type { AccountId } from './account.types';

import type {
  AccountSessionRecord,
  CreateAccountSessionResult,
} from './account-session.types';

@Injectable()
export class AccountSessionService {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly accountSessionRepository: AccountSessionRepository,
  ) {}

  async createSession(
    accountId: AccountId,
  ): Promise<CreateAccountSessionResult> {
    await this.requireAccount(accountId);

    const token = createAccountSessionToken();

    const tokenHash = hashAccountSessionToken(token);

    const expiresAt = new Date(Date.now() + ACCOUNT_SESSION_TTL_MS);

    const session = await this.accountSessionRepository.create({
      accountId,
      tokenHash,
      expiresAt,
    });

    return {
      token,
      session,
    };
  }

  async resolveActiveSession(
    token: unknown,
  ): Promise<AccountSessionRecord | undefined> {
    if (!isAccountSessionToken(token)) {
      return undefined;
    }

    const tokenHash = hashAccountSessionToken(token);

    const session =
      await this.accountSessionRepository.findByTokenHash(tokenHash);

    if (!session) {
      return undefined;
    }

    if (session.revokedAt !== null) {
      return undefined;
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      return undefined;
    }

    return session;
  }

  async revokeSession(token: unknown): Promise<boolean> {
    if (!isAccountSessionToken(token)) {
      return false;
    }

    const tokenHash = hashAccountSessionToken(token);

    return this.accountSessionRepository.revokeByTokenHash(
      tokenHash,
      new Date(),
    );
  }

  private async requireAccount(accountId: AccountId): Promise<void> {
    const account = await this.accountRepository.findById(accountId);

    if (!account) {
      throw new Error(`Account "${accountId}" does not exist`);
    }
  }
}
