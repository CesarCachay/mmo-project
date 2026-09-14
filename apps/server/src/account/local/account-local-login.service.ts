import { Inject, Injectable } from '@nestjs/common';

import { AccountRepository } from '../account.repository';

import { AccountSessionService } from '../account-session.service';

import { AccountPasswordCredentialRepository } from './account-password.repository';

import { LocalAccountLoginError } from './account-local-auth.errors';

import { PasswordHasherService } from './password-hasher.service';

import type { AccountRecord } from '../account.types';

import type {
  LocalAccountRecord,
  LoginLocalAccountInput,
  LoginLocalAccountResult,
} from './account-local-auth.types';

function isLocalAccountRecord(
  account: AccountRecord,
): account is LocalAccountRecord {
  return account.provider === 'LOCAL';
}

@Injectable()
export class AccountLocalLoginService {
  constructor(
    @Inject(AccountRepository)
    private readonly accountRepository: AccountRepository,

    @Inject(AccountPasswordCredentialRepository)
    private readonly passwordCredentialRepository: AccountPasswordCredentialRepository,

    @Inject(PasswordHasherService)
    private readonly passwordHasherService: PasswordHasherService,

    @Inject(AccountSessionService)
    private readonly accountSessionService: AccountSessionService,
  ) {}

  async login(input: LoginLocalAccountInput): Promise<LoginLocalAccountResult> {
    const loginId = this.normalizeLoginId(input.loginId);

    if (!loginId || typeof input.password !== 'string') {
      throw this.invalidCredentials();
    }

    const account = await this.accountRepository.findByProviderIdentity(
      'LOCAL',
      loginId,
    );

    if (!account || !isLocalAccountRecord(account)) {
      await this.passwordHasherService.hash(input.password);
      throw this.invalidCredentials();
    }

    const credential = await this.passwordCredentialRepository.findByAccountId(
      account.accountId,
    );

    if (!credential) {
      /*
       * A LOCAL Account should always have a credential.
       * Do not expose that persistence inconsistency to the client.
       */
      await this.passwordHasherService.hash(input.password);

      throw this.invalidCredentials();
    }

    const passwordMatches = await this.passwordHasherService.verify(
      credential.passwordHash,
      input.password,
    );

    if (!passwordMatches) {
      throw this.invalidCredentials();
    }

    const { session, token } = await this.accountSessionService.createSession(
      account.accountId,
    );

    return {
      account,
      session,
      token,
    };
  }

  private normalizeLoginId(loginId: unknown): string {
    if (typeof loginId !== 'string') {
      return '';
    }

    return loginId.trim().toLowerCase();
  }

  private invalidCredentials(): LocalAccountLoginError {
    return new LocalAccountLoginError('INVALID_CREDENTIALS');
  }
}
