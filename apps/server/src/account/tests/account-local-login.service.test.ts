import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AccountLocalLoginService } from '#app/account/local/account-local-login.service';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';

const SESSION_TOKEN = `accs_${'a'.repeat(43)}`;

describe('AccountLocalLoginService', () => {
  const accountRepository = {
    findByProviderIdentity: vi.fn(),
  };

  const passwordCredentialRepository = {
    findByAccountId: vi.fn(),
  };

  const passwordHasherService = {
    hash: vi.fn(),
    verify: vi.fn(),
  };

  const accountSessionService = {
    createSession: vi.fn(),
  };

  let service: AccountLocalLoginService;

  beforeEach(() => {
    vi.clearAllMocks();

    service = new AccountLocalLoginService(
      accountRepository as never,
      passwordCredentialRepository as never,
      passwordHasherService as never,
      accountSessionService as never,
    );
  });

  it('logs in a valid local Account and creates an AccountSession', async () => {
    const account = {
      accountId: ACCOUNT_ID,
      provider: 'LOCAL',
      providerUserId: 'cesar.mmo',
      email: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    accountRepository.findByProviderIdentity.mockResolvedValue(account);

    passwordCredentialRepository.findByAccountId.mockResolvedValue({
      accountId: ACCOUNT_ID,
      passwordHash: '$argon2id$hash',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    passwordHasherService.verify.mockResolvedValue(true);

    accountSessionService.createSession.mockResolvedValue({
      token: SESSION_TOKEN,

      session: {
        sessionId: '22222222-2222-4222-8222-222222222222',
        accountId: ACCOUNT_ID,
        expiresAt: new Date(),
        revokedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const result = await service.login({
      loginId: '  Cesar.MMO ',

      password: 'StrongPassword123!',
    });

    expect(accountRepository.findByProviderIdentity).toHaveBeenCalledWith(
      'LOCAL',
      'cesar.mmo',
    );

    expect(passwordHasherService.verify).toHaveBeenCalledWith(
      '$argon2id$hash',
      'StrongPassword123!',
    );

    expect(accountSessionService.createSession).toHaveBeenCalledWith(
      ACCOUNT_ID,
    );

    expect(result.account).toBe(account);
  });

  it('returns INVALID_CREDENTIALS for an unknown login id', async () => {
    accountRepository.findByProviderIdentity.mockResolvedValue(undefined);
    passwordHasherService.hash.mockResolvedValue('$argon2id$dummy');

    await expect(
      service.login({
        loginId: 'missing-user',
        password: 'StrongPassword123!',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });

    expect(accountSessionService.createSession).not.toHaveBeenCalled();
  });

  it('returns the same INVALID_CREDENTIALS error for a wrong password', async () => {
    accountRepository.findByProviderIdentity.mockResolvedValue({
      accountId: ACCOUNT_ID,
      provider: 'LOCAL',
      providerUserId: 'cesar',
      email: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    passwordCredentialRepository.findByAccountId.mockResolvedValue({
      accountId: ACCOUNT_ID,
      passwordHash: '$argon2id$hash',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    passwordHasherService.verify.mockResolvedValue(false);

    await expect(
      service.login({
        loginId: 'cesar',
        password: 'WrongPassword123!',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });

    expect(accountSessionService.createSession).not.toHaveBeenCalled();
  });

  it('does not normalize the password', async () => {
    accountRepository.findByProviderIdentity.mockResolvedValue({
      accountId: ACCOUNT_ID,
      provider: 'LOCAL',
      providerUserId: 'cesar',
      email: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    passwordCredentialRepository.findByAccountId.mockResolvedValue({
      accountId: ACCOUNT_ID,
      passwordHash: '$argon2id$hash',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    passwordHasherService.verify.mockResolvedValue(false);

    const password = ' Password123! ';

    await expect(
      service.login({
        loginId: 'cesar',
        password,
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });

    expect(passwordHasherService.verify).toHaveBeenCalledWith(
      '$argon2id$hash',
      password,
    );
  });
});
