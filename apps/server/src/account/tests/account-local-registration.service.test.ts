import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AccountLocalRegistrationService } from '../local/account-local-registration.service';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';

const SESSION_TOKEN = `accs_${'a'.repeat(43)}`;

describe('AccountLocalRegistrationService', () => {
  const registrationRepository = {
    create: vi.fn(),
  };

  const passwordHasherService = {
    hash: vi.fn(),
  };

  const accountSessionService = {
    createSession: vi.fn(),
  };

  let service: AccountLocalRegistrationService;

  beforeEach(() => {
    vi.clearAllMocks();

    service = new AccountLocalRegistrationService(
      registrationRepository as never,
      passwordHasherService as never,
      accountSessionService as never,
    );
  });

  it('normalizes the login id and creates a local Account', async () => {
    passwordHasherService.hash.mockResolvedValue('$argon2id$hashed-password');

    registrationRepository.create.mockResolvedValue({
      accountId: ACCOUNT_ID,
      provider: 'LOCAL',
      providerUserId: 'cesar.mmo',
      email: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

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

    const result = await service.register({
      loginId: '  Cesar.MMO  ',
      password: 'StrongPassword123!',
    });

    expect(passwordHasherService.hash).toHaveBeenCalledWith(
      'StrongPassword123!',
    );

    expect(registrationRepository.create).toHaveBeenCalledWith({
      loginId: 'cesar.mmo',

      passwordHash: '$argon2id$hashed-password',
    });

    expect(result.account.provider).toBe('LOCAL');
  });

  it.each(['', 'ab', 'user name', 'cesar@email'])(
    'rejects invalid login id "%s"',
    async (loginId) => {
      await expect(
        service.register({
          loginId,
          password: 'StrongPassword123!',
        }),
      ).rejects.toMatchObject({
        code: 'INVALID_LOGIN_ID',
      });
    },
  );

  it('rejects a short password before hashing it', async () => {
    await expect(
      service.register({
        loginId: 'cesar',
        password: 'short',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_PASSWORD',
    });

    expect(passwordHasherService.hash).not.toHaveBeenCalled();
  });

  it('does not normalize the password', async () => {
    passwordHasherService.hash.mockResolvedValue('$argon2id$hash');

    registrationRepository.create.mockResolvedValue({
      accountId: ACCOUNT_ID,
      provider: 'LOCAL',
      providerUserId: 'cesar',
      email: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

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

    const password = ' StrongPassword123! ';

    await service.register({
      loginId: 'cesar',
      password,
    });

    expect(passwordHasherService.hash).toHaveBeenCalledWith(password);
  });
});
