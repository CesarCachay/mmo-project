import { afterEach, describe, expect, it, vi } from 'vitest';

import { AccountSessionService } from '../account-session.service';

import { hashAccountSessionToken } from '../account-session-token';

import type { AccountRepository } from '../account.repository';
import type { AccountSessionRepository } from '../account-session.repository';

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

afterEach(() => {
  vi.useRealTimers();
});

describe('AccounSessionService', () => {
  it('creates an Account session without persisting the raw token', async () => {
    vi.useFakeTimers();

    const now = new Date('2026-09-13T12:00:00.000Z');

    vi.setSystemTime(now);

    const findById = vi.fn(() => Promise.resolve(account));

    type CreateInput = Parameters<AccountSessionRepository['create']>[0];

    const create = vi.fn((input: CreateInput): Promise<AccountSessionRecord> =>
      Promise.resolve({
        sessionId,
        accountId: input.accountId,
        expiresAt: input.expiresAt,
        revokedAt: null,
        createdAt: now,
        updatedAt: now,
      }),
    );

    const accountRepository = {
      findById,
    } as unknown as AccountRepository;

    const accountSessionRepository = {
      create,
    } as unknown as AccountSessionRepository;

    const service = new AccountSessionService(
      accountRepository,
      accountSessionRepository,
    );

    const result = await service.createSession(accountId);

    expect(result.token.startsWith('accs_')).toBe(true);

    expect(create).toHaveBeenCalledTimes(1);

    const persistenceInput = create.mock.calls[0]?.[0];

    if (!persistenceInput) {
      throw new Error('Expected AccountSessionRepository.create input');
    }

    expect(persistenceInput.accountId).toBe(accountId);

    expect(persistenceInput.tokenHash).toBe(
      hashAccountSessionToken(result.token),
    );

    expect(persistenceInput.tokenHash).not.toBe(result.token);

    expect(persistenceInput.expiresAt.toISOString()).toBe(
      '2026-10-13T12:00:00.000Z',
    );
  });

  it('resolves an active Account session', async () => {
    vi.useFakeTimers();

    vi.setSystemTime(new Date('2026-09-13T12:00:00.000Z'));

    const token = 'accs_1234567890123456789012345678901234567890123';

    const session: AccountSessionRecord = {
      sessionId,
      accountId,
      expiresAt: new Date('2026-09-14T12:00:00.000Z'),
      revokedAt: null,
      createdAt: new Date('2026-09-13T10:00:00.000Z'),
      updatedAt: new Date('2026-09-13T10:00:00.000Z'),
    };

    const findByTokenHash = vi.fn(() => Promise.resolve(session));

    const accountRepository = {} as AccountRepository;

    const accountSessionRepository = {
      findByTokenHash,
    } as unknown as AccountSessionRepository;

    const service = new AccountSessionService(
      accountRepository,
      accountSessionRepository,
    );

    const result = await service.resolveActiveSession(token);

    expect(result).toEqual(session);

    expect(findByTokenHash).toHaveBeenCalledWith(
      hashAccountSessionToken(token),
    );
  });

  it('rejects an expired Account session', async () => {
    vi.useFakeTimers();

    vi.setSystemTime(new Date('2026-09-13T12:00:00.000Z'));

    const token = 'accs_1234567890123456789012345678901234567890123';

    const session: AccountSessionRecord = {
      sessionId,
      accountId,
      expiresAt: new Date('2026-09-13T11:59:59.000Z'),
      revokedAt: null,
      createdAt: new Date('2026-09-01T12:00:00.000Z'),
      updatedAt: new Date('2026-09-01T12:00:00.000Z'),
    };

    const findByTokenHash = vi.fn(() => Promise.resolve(session));

    const service = new AccountSessionService(
      {} as AccountRepository,
      {
        findByTokenHash,
      } as unknown as AccountSessionRepository,
    );

    const result = await service.resolveActiveSession(token);

    expect(result).toBeUndefined();
  });

  it('rejects a revoked Account session', async () => {
    const token = 'accs_1234567890123456789012345678901234567890123';

    const session: AccountSessionRecord = {
      sessionId,
      accountId,
      expiresAt: new Date('2026-10-13T12:00:00.000Z'),
      revokedAt: new Date('2026-09-13T11:00:00.000Z'),
      createdAt: new Date('2026-09-01T12:00:00.000Z'),
      updatedAt: new Date('2026-09-13T11:00:00.000Z'),
    };

    const findByTokenHash = vi.fn(() => Promise.resolve(session));

    const service = new AccountSessionService(
      {} as AccountRepository,
      {
        findByTokenHash,
      } as unknown as AccountSessionRepository,
    );

    expect(await service.resolveActiveSession(token)).toBeUndefined();
  });

  it('rejects an invalid Account session token before querying persistence', async () => {
    const findByTokenHash = vi.fn();

    const service = new AccountSessionService(
      {} as AccountRepository,
      {
        findByTokenHash,
      } as unknown as AccountSessionRepository,
    );

    const result = await service.resolveActiveSession('totally-invalid-token');

    expect(result).toBeUndefined();

    expect(findByTokenHash).not.toHaveBeenCalled();
  });
});
