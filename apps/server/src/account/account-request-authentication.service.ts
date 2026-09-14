import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';

import type { Request } from 'express';

import { AccountAuthenticationService } from './account-authentication.service';

import { getAccountSessionTokenFromCookieHeader } from './account-session-cookie';

type AuthenticatedAccountContext = NonNullable<
  Awaited<
    ReturnType<AccountAuthenticationService['resolveAuthenticatedAccount']>
  >
>;

@Injectable()
export class AccountRequestAuthenticationService {
  constructor(
    @Inject(AccountAuthenticationService)
    private readonly accountAuthenticationService: AccountAuthenticationService,
  ) {}

  async requireAuthenticatedAccount(
    request: Request,
  ): Promise<AuthenticatedAccountContext> {
    const token = getAccountSessionTokenFromCookieHeader(
      request.headers.cookie,
    );

    const context =
      await this.accountAuthenticationService.resolveAuthenticatedAccount(
        token,
      );

    if (!context) {
      throw new UnauthorizedException();
    }

    return context;
  }
}
