import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AccountService } from '../account.service';
import { AccountSessionService } from '../account-session.service';

import { AccountGoogleLoginService } from '../google/account-google-login.service';
import { GoogleIdentityService } from '../google/google-identity.service';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';

const SESSION_ID = '22222222-2222-4222-8222-222222222222';

const SESSION_TOKEN = `accs_${'a'.repeat(43)}`;

describe('AccountGoogleLoginService', () => {
  const verifyCredential = vi.fn<GoogleIdentityService['verifyCredential']>();

  const resolveProviderAccount =
    vi.fn<AccountService['resolveProviderAccount']>();

  const createSession = vi.fn<AccountSessionService['createSession']>();

  let service: AccountGoogleLoginService;

  beforeEach(() => {
    vi.clearAllMocks();

    service = new AccountGoogleLoginService(
      {
        verifyCredential,
      } as unknown as GoogleIdentityService,

      {
        resolveProviderAccount,
      } as unknown as AccountService,

      {
        createSession,
      } as unknown as AccountSessionService,
    );
  });

  it('verifies Google identity, resolves the account and creates an account session', async () => {
    verifyCredential.mockResolvedValue({
      provider: 'GOOGLE',
      providerUserId: 'google-user-123',
      email: 'cesar@example.com',
    });

    resolveProviderAccount.mockResolvedValue({
      accountId: ACCOUNT_ID,
      provider: 'GOOGLE',
      providerUserId: 'google-user-123',
      email: 'cesar@example.com',
      createdAt: new Date('2026-09-13T12:00:00.000Z'),
      updatedAt: new Date('2026-09-13T12:00:00.000Z'),
    });

    createSession.mockResolvedValue({
      token: SESSION_TOKEN,

      session: {
        sessionId: SESSION_ID,
        accountId: ACCOUNT_ID,
        expiresAt: new Date('2026-10-13T12:00:00.000Z'),
        revokedAt: null,
        createdAt: new Date('2026-09-13T12:00:00.000Z'),
        updatedAt: new Date('2026-09-13T12:00:00.000Z'),
      },
    });

    const result = await service.login('google-id-token');

    expect(verifyCredential).toHaveBeenCalledWith('google-id-token');

    expect(resolveProviderAccount).toHaveBeenCalledWith({
      provider: 'GOOGLE',
      providerUserId: 'google-user-123',
      email: 'cesar@example.com',
    });

    expect(createSession).toHaveBeenCalledWith(ACCOUNT_ID);

    expect(result.token).toBe(SESSION_TOKEN);

    expect(result.account.accountId).toBe(ACCOUNT_ID);

    expect(result.session.sessionId).toBe(SESSION_ID);
  });

  it('does not resolve an account when Google verification fails', async () => {
    verifyCredential.mockRejectedValue(new Error('Invalid Google credential'));

    await expect(service.login('invalid-token')).rejects.toThrow(
      'Invalid Google credential',
    );

    expect(resolveProviderAccount).not.toHaveBeenCalled();

    expect(createSession).not.toHaveBeenCalled();
  });

  it('does not create a session when account resolution fails', async () => {
    verifyCredential.mockResolvedValue({
      provider: 'GOOGLE',
      providerUserId: 'google-user-123',
      email: 'cesar@example.com',
    });

    resolveProviderAccount.mockRejectedValue(
      new Error('Account persistence failed'),
    );

    await expect(service.login('google-id-token')).rejects.toThrow(
      'Account persistence failed',
    );

    expect(createSession).not.toHaveBeenCalled();
  });
});
