import { Injectable } from '@nestjs/common';

import { AccountRepository } from './account.repository';
import { AccountSessionService } from './account-session.service';

import type { AuthenticatedAccountContext } from './account-authentication.types';

@Injectable()
export class AccountAuthenticationService {
  constructor(
    private readonly accountSessionService: AccountSessionService,
    private readonly accountRepository: AccountRepository,
  ) {}

  async resolveAuthenticatedAccount(
    token: unknown,
  ): Promise<AuthenticatedAccountContext | undefined> {
    const session =
      await this.accountSessionService.resolveActiveSession(token);

    if (!session) {
      return undefined;
    }

    const account = await this.accountRepository.findById(session.accountId);

    if (!account) {
      return undefined;
    }

    return {
      account,
      session,
    };
  }
}
