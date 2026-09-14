import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AccountAuthenticationService } from '../account-authentication.service';

import { AccountTrainerService } from '../account-trainer.service';

import {
  AccountSocketAuthenticationError,
  AccountSocketAuthenticationService,
} from '../account-socket-authentication.service';

import { ACCOUNT_SESSION_COOKIE_NAME } from '../account-session-cookie';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';

const TRAINER_ID = '22222222-2222-4222-8222-222222222222';

const SESSION_ID = '33333333-3333-4333-8333-333333333333';

const SESSION_TOKEN = `accs_${'a'.repeat(43)}`;

const SESSION_COOKIE = `${ACCOUNT_SESSION_COOKIE_NAME}=${SESSION_TOKEN}`;

const CREATED_AT = new Date('2026-09-14T12:00:00.000Z');

const UPDATED_AT = new Date('2026-09-14T13:00:00.000Z');

describe('AccountSocketAuthenticationService', () => {
  const authenticationService = {
    resolveAuthenticatedAccount: vi.fn(),
  };

  const accountTrainerService = {
    listTrainers: vi.fn(),
  };

  let service: AccountSocketAuthenticationService;

  beforeEach(() => {
    vi.clearAllMocks();

    const authenticationServiceMock =
      authenticationService as unknown as AccountAuthenticationService;

    const trainerServiceMock =
      accountTrainerService as unknown as AccountTrainerService;

    service = new AccountSocketAuthenticationService(
      authenticationServiceMock,
      trainerServiceMock,
    );
  });

  it('resolves an authenticated Account and owned Trainer', async () => {
    const account = {
      accountId: ACCOUNT_ID,

      provider: 'GOOGLE' as const,

      providerUserId: 'google-user-123',

      email: 'cesar@example.com',

      createdAt: CREATED_AT,

      updatedAt: UPDATED_AT,
    };

    const session = {
      sessionId: SESSION_ID,

      accountId: ACCOUNT_ID,

      expiresAt: new Date('2026-10-14T12:00:00.000Z'),

      revokedAt: null,

      createdAt: CREATED_AT,

      updatedAt: UPDATED_AT,
    };

    const trainer = {
      trainerId: TRAINER_ID,

      accountId: ACCOUNT_ID,

      displayName: 'Cesar',

      avatarId: 'male-01',

      createdAt: CREATED_AT,

      updatedAt: UPDATED_AT,
    };

    authenticationService.resolveAuthenticatedAccount.mockResolvedValue({
      account,
      session,
    });

    accountTrainerService.listTrainers.mockResolvedValue([trainer]);

    const result = await service.requireAuthenticatedTrainer({
      cookieHeader: SESSION_COOKIE,

      selectedTrainerId: TRAINER_ID,
    });

    expect(
      authenticationService.resolveAuthenticatedAccount,
    ).toHaveBeenCalledWith(SESSION_TOKEN);

    expect(accountTrainerService.listTrainers).toHaveBeenCalledWith(ACCOUNT_ID);

    expect(result).toEqual({
      account,
      session,
      trainer,
    });
  });

  it('rejects a socket without an authenticated Account session', async () => {
    authenticationService.resolveAuthenticatedAccount.mockResolvedValue(
      undefined,
    );

    try {
      await service.requireAuthenticatedTrainer({
        cookieHeader: undefined,

        selectedTrainerId: TRAINER_ID,
      });

      throw new Error('Expected authentication to fail');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(AccountSocketAuthenticationError);

      if (!(error instanceof AccountSocketAuthenticationError)) {
        throw error;
      }

      expect(error.code).toBe('ACCOUNT_SESSION_REQUIRED');
    }

    expect(accountTrainerService.listTrainers).not.toHaveBeenCalled();
  });

  it('rejects a socket when no Trainer was selected', async () => {
    authenticationService.resolveAuthenticatedAccount.mockResolvedValue({
      account: {
        accountId: ACCOUNT_ID,
      },

      session: {
        sessionId: SESSION_ID,
      },
    });

    try {
      await service.requireAuthenticatedTrainer({
        cookieHeader: SESSION_COOKIE,

        selectedTrainerId: undefined,
      });

      throw new Error('Expected Trainer selection to fail');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(AccountSocketAuthenticationError);

      if (!(error instanceof AccountSocketAuthenticationError)) {
        throw error;
      }

      expect(error.code).toBe('TRAINER_REQUIRED');
    }

    expect(accountTrainerService.listTrainers).not.toHaveBeenCalled();
  });

  it('rejects a Trainer owned by another Account', async () => {
    authenticationService.resolveAuthenticatedAccount.mockResolvedValue({
      account: {
        accountId: ACCOUNT_ID,
      },

      session: {
        sessionId: SESSION_ID,
      },
    });

    accountTrainerService.listTrainers.mockResolvedValue([
      {
        trainerId: '44444444-4444-4444-8444-444444444444',

        accountId: ACCOUNT_ID,

        displayName: 'Other',

        avatarId: 'female-01',

        createdAt: CREATED_AT,

        updatedAt: UPDATED_AT,
      },
    ]);

    try {
      await service.requireAuthenticatedTrainer({
        cookieHeader: SESSION_COOKIE,

        selectedTrainerId: TRAINER_ID,
      });

      throw new Error('Expected Trainer ownership validation to fail');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(AccountSocketAuthenticationError);

      if (!(error instanceof AccountSocketAuthenticationError)) {
        throw error;
      }

      expect(error.code).toBe('TRAINER_NOT_OWNED');
    }
  });
});
