import { Inject, Injectable } from '@nestjs/common';

import { AccountAuthenticationService } from './account-authentication.service';

import { AccountTrainerService } from './account-trainer.service';

import { getAccountSessionTokenFromCookieHeader } from './account-session-cookie';

type AuthenticatedAccountContext = NonNullable<
  Awaited<
    ReturnType<AccountAuthenticationService['resolveAuthenticatedAccount']>
  >
>;

type OwnedTrainer = Awaited<
  ReturnType<AccountTrainerService['listTrainers']>
>[number];

export type AccountSocketAuthenticationErrorCode =
  'ACCOUNT_SESSION_REQUIRED' | 'TRAINER_REQUIRED' | 'TRAINER_NOT_OWNED';

export class AccountSocketAuthenticationError extends Error {
  readonly code: AccountSocketAuthenticationErrorCode;

  constructor(code: AccountSocketAuthenticationErrorCode, message: string) {
    super(message);
    this.name = 'AccountSocketAuthenticationError';
    this.code = code;
  }
}

export type AccountSocketAuthenticationInput = {
  cookieHeader: string | undefined;
  selectedTrainerId: unknown;
};

export type AccountSocketAuthenticationResult = {
  account: AuthenticatedAccountContext['account'];
  session: AuthenticatedAccountContext['session'];
  trainer: OwnedTrainer;
};

@Injectable()
export class AccountSocketAuthenticationService {
  constructor(
    @Inject(AccountAuthenticationService)
    private readonly accountAuthenticationService: AccountAuthenticationService,

    @Inject(AccountTrainerService)
    private readonly accountTrainerService: AccountTrainerService,
  ) {}

  async requireAuthenticatedTrainer(
    input: AccountSocketAuthenticationInput,
  ): Promise<AccountSocketAuthenticationResult> {
    const token = getAccountSessionTokenFromCookieHeader(input.cookieHeader);

    const context =
      await this.accountAuthenticationService.resolveAuthenticatedAccount(
        token,
      );

    if (!context) {
      throw new AccountSocketAuthenticationError(
        'ACCOUNT_SESSION_REQUIRED',
        'An authenticated Account session is required',
      );
    }

    const selectedTrainerId =
      typeof input.selectedTrainerId === 'string'
        ? input.selectedTrainerId.trim()
        : '';

    if (!selectedTrainerId) {
      throw new AccountSocketAuthenticationError(
        'TRAINER_REQUIRED',
        'A Trainer must be selected',
      );
    }

    const trainers = await this.accountTrainerService.listTrainers(
      context.account.accountId,
    );

    const trainer = trainers.find(
      (candidate) => candidate.trainerId === selectedTrainerId,
    );

    if (!trainer) {
      throw new AccountSocketAuthenticationError(
        'TRAINER_NOT_OWNED',
        'The selected Trainer does not belong to the authenticated Account',
      );
    }

    return {
      account: context.account,
      session: context.session,
      trainer,
    };
  }
}
