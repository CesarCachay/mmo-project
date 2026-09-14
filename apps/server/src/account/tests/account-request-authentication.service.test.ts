import { UnauthorizedException } from '@nestjs/common';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Request } from 'express';

import { AccountAuthenticationService } from '../account-authentication.service';

import { AccountRequestAuthenticationService } from '../account-request-authentication.service';

import { ACCOUNT_SESSION_COOKIE_NAME } from '../account-session-cookie';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';

const SESSION_ID = '22222222-2222-4222-8222-222222222222';

const SESSION_TOKEN = `accs_${'a'.repeat(43)}`;

describe('AccountRequestAuthenticationService', () => {
  const authenticationService = {
    resolveAuthenticatedAccount: vi.fn(),
  };

  let service: AccountRequestAuthenticationService;

  beforeEach(() => {
    vi.clearAllMocks();

    service = new AccountRequestAuthenticationService(
      authenticationService as unknown as AccountAuthenticationService,
    );
  });

  it('returns the authenticated account context from the session cookie', async () => {
    const context = {
      account: {
        accountId: ACCOUNT_ID,
        provider: 'GOOGLE' as const,
        providerUserId: 'google-user-123',
        email: 'cesar@example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      },

      session: {
        sessionId: SESSION_ID,
        accountId: ACCOUNT_ID,
        expiresAt: new Date('2026-10-13T12:00:00.000Z'),
        revokedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    authenticationService.resolveAuthenticatedAccount.mockResolvedValue(
      context,
    );

    const request = {
      headers: {
        cookie: `${ACCOUNT_SESSION_COOKIE_NAME}=${SESSION_TOKEN}`,
      },
    } as Request;

    const result = await service.requireAuthenticatedAccount(request);

    expect(result).toBe(context);

    expect(
      authenticationService.resolveAuthenticatedAccount,
    ).toHaveBeenCalledWith(SESSION_TOKEN);
  });

  it('throws 401 when there is no session cookie', async () => {
    authenticationService.resolveAuthenticatedAccount.mockResolvedValue(
      undefined,
    );

    const request = {
      headers: {},
    } as Request;

    await expect(
      service.requireAuthenticatedAccount(request),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(
      authenticationService.resolveAuthenticatedAccount,
    ).toHaveBeenCalledWith(undefined);
  });

  it('throws 401 when the cookie is malformed', async () => {
    authenticationService.resolveAuthenticatedAccount.mockResolvedValue(
      undefined,
    );

    const request = {
      headers: {
        cookie: `${ACCOUNT_SESSION_COOKIE_NAME}=invalid-token`,
      },
    } as Request;

    await expect(
      service.requireAuthenticatedAccount(request),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(
      authenticationService.resolveAuthenticatedAccount,
    ).toHaveBeenCalledWith(undefined);
  });
});
