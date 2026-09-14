import { Inject, Injectable } from '@nestjs/common';

import { AccountSessionService } from '../account-session.service';

import {
  LOCAL_LOGIN_ID_MAX_LENGTH,
  LOCAL_LOGIN_ID_MIN_LENGTH,
  LOCAL_LOGIN_ID_PATTERN,
  LOCAL_PASSWORD_MAX_LENGTH,
  LOCAL_PASSWORD_MIN_LENGTH,
} from './account-local-auth.constants';

import { LocalAccountRegistrationError } from './account-local-auth.errors';

import type {
  RegisterLocalAccountInput,
  RegisterLocalAccountResult,
} from './account-local-auth.types';

import { AccountLocalRegistrationRepository } from './account-local-registration.repository';

import { PasswordHasherService } from './password-hasher.service';

@Injectable()
export class AccountLocalRegistrationService {
  constructor(
    @Inject(AccountLocalRegistrationRepository)
    private readonly registrationRepository: AccountLocalRegistrationRepository,

    @Inject(PasswordHasherService)
    private readonly passwordHasherService: PasswordHasherService,

    @Inject(AccountSessionService)
    private readonly accountSessionService: AccountSessionService,
  ) {}

  async register(
    input: RegisterLocalAccountInput,
  ): Promise<RegisterLocalAccountResult> {
    const loginId = this.normalizeLoginId(input.loginId);

    this.validateLoginId(loginId);

    this.validatePassword(input.password);

    const passwordHash = await this.passwordHasherService.hash(input.password);

    const account = await this.registrationRepository.create({
      loginId,
      passwordHash,
    });

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

  private validateLoginId(loginId: string): void {
    if (
      loginId.length < LOCAL_LOGIN_ID_MIN_LENGTH ||
      loginId.length > LOCAL_LOGIN_ID_MAX_LENGTH ||
      !LOCAL_LOGIN_ID_PATTERN.test(loginId)
    ) {
      throw new LocalAccountRegistrationError(
        'INVALID_LOGIN_ID',
        'Login id must be 3-32 characters using letters, numbers, ".", "_" or "-"',
      );
    }
  }

  private validatePassword(password: unknown): asserts password is string {
    if (
      typeof password !== 'string' ||
      password.length < LOCAL_PASSWORD_MIN_LENGTH ||
      password.length > LOCAL_PASSWORD_MAX_LENGTH
    ) {
      throw new LocalAccountRegistrationError(
        'INVALID_PASSWORD',
        'Password must be between 10 and 128 characters',
      );
    }
  }
}
