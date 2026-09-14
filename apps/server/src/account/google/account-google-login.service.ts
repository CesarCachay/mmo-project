import { Inject, Injectable } from '@nestjs/common';

import { AccountService } from '../account.service';
import { AccountSessionService } from '../account-session.service';

import { GoogleIdentityService } from './google-identity.service';

import type { AccountRecord } from '../account.types';
import type {
  AccountSessionRecord,
  AccountSessionToken,
} from '../account-session.types';

export type AccountGoogleLoginResult = {
  account: AccountRecord;
  session: AccountSessionRecord;
  token: AccountSessionToken;
};

@Injectable()
export class AccountGoogleLoginService {
  constructor(
    @Inject(GoogleIdentityService)
    private readonly googleIdentityService: GoogleIdentityService,

    @Inject(AccountService)
    private readonly accountService: AccountService,

    @Inject(AccountSessionService)
    private readonly accountSessionService: AccountSessionService,
  ) {}

  async login(credential: unknown): Promise<AccountGoogleLoginResult> {
    const identity =
      await this.googleIdentityService.verifyCredential(credential);

    const account = await this.accountService.resolveProviderAccount({
      provider: identity.provider,
      providerUserId: identity.providerUserId,
      email: identity.email,
    });

    const { token, session } = await this.accountSessionService.createSession(
      account.accountId,
    );

    return {
      account,
      session,
      token,
    };
  }
}
