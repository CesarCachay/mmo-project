import { describe, expect, it, vi } from 'vitest';

import { AccountAuthenticationService } from '../account-authentication.service';

import type { AccountRepository } from '../account.repository';
import type { AccountSessionService } from '../account-session.service';

import type { AccountRecord } from '../account.types';
import type { AccountSessionRecord } from '../account-session.types';

const accountId = '11111111-1111-4111-8111-111111111111';

const sessionId = '22222222-2222-4222-8222-222222222222';

const account: AccountRecord = {
  accountId,
  provider: 'GOOGLE',
  providerUserId: 'google-user-123',
  email: 'trainer@example.com',

  createdAt: new Date('2026-09-13T12:00:00.000Z'),

  updatedAt: new Date('2026-09-13T12:00:00.000Z'),
};

const session: AccountSessionRecord = {
  sessionId,
  accountId,

  expiresAt: new Date('2026-10-13T12:00:00.000Z'),

  revokedAt: null,

  createdAt: new Date('2026-09-13T12:00:00.000Z'),

  updatedAt: new Date('2026-09-13T12:00:00.000Z'),
};

describe('AccountAuthenticationService', () => {
  it('resolves an authenticated Account from an active session', async () => {
    const resolveActiveSession = vi.fn(() => Promise.resolve(session));

    const findById = vi.fn(() => Promise.resolve(account));

    const accountSessionService = {
      resolveActiveSession,
    } as unknown as AccountSessionService;

    const accountRepository = {
      findById,
    } as unknown as AccountRepository;

    const service = new AccountAuthenticationService(
      accountSessionService,
      accountRepository,
    );

    const token = 'accs_1234567890123456789012345678901234567890123';

    const result = await service.resolveAuthenticatedAccount(token);

    expect(result).toEqual({
      account,
      session,
    });

    expect(resolveActiveSession).toHaveBeenCalledWith(token);

    expect(findById).toHaveBeenCalledWith(accountId);
  });

  it('rejects authentication when the Account session is invalid', async () => {
    const resolveActiveSession = vi.fn(() => Promise.resolve(undefined));

    const findById = vi.fn();

    const accountSessionService = {
      resolveActiveSession,
    } as unknown as AccountSessionService;

    const accountRepository = {
      findById,
    } as unknown as AccountRepository;

    const service = new AccountAuthenticationService(
      accountSessionService,
      accountRepository,
    );

    const result = await service.resolveAuthenticatedAccount('invalid-token');

    expect(result).toBeUndefined();

    expect(findById).not.toHaveBeenCalled();
  });

  it('rejects authentication when the session Account no longer exists', async () => {
    const resolveActiveSession = vi.fn(() => Promise.resolve(session));

    const findById = vi.fn(() => Promise.resolve(undefined));

    const accountSessionService = {
      resolveActiveSession,
    } as unknown as AccountSessionService;

    const accountRepository = {
      findById,
    } as unknown as AccountRepository;

    const service = new AccountAuthenticationService(
      accountSessionService,
      accountRepository,
    );

    const result = await service.resolveAuthenticatedAccount(
      'accs_1234567890123456789012345678901234567890123',
    );

    expect(result).toBeUndefined();

    expect(findById).toHaveBeenCalledWith(accountId);
  });
});
