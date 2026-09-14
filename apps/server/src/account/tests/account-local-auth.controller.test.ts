import type { INestApplication } from '@nestjs/common';

import { Test } from '@nestjs/testing';

import request from 'supertest';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AccountLocalAuthController } from '#app/account/local/account-local-auth.controller';

import {
  LocalAccountLoginError,
  LocalAccountRegistrationError,
} from '#app/account/local/account-local-auth.errors';

import { AccountLocalLoginService } from '#app/account/local/account-local-login.service';

import { AccountLocalRegistrationService } from '#app/account/local/account-local-registration.service';

import { ACCOUNT_SESSION_COOKIE_NAME } from '#app/account/account-session-cookie';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';

const SESSION_TOKEN = `accs_${'a'.repeat(43)}`;

const SESSION_EXPIRES_AT = new Date('2026-10-14T12:00:00.000Z');

function createAuthResult() {
  return {
    account: {
      accountId: ACCOUNT_ID,
      provider: 'LOCAL' as const,
      providerUserId: 'cesar.mmo',
      email: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },

    session: {
      sessionId: '22222222-2222-4222-8222-222222222222',
      accountId: ACCOUNT_ID,
      expiresAt: SESSION_EXPIRES_AT,
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },

    token: SESSION_TOKEN,
  };
}

describe('AccountLocalAuthController', () => {
  let app: INestApplication;

  const registrationService = {
    register: vi.fn(),
  };

  const loginService = {
    login: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [AccountLocalAuthController],

      providers: [
        {
          provide: AccountLocalRegistrationService,
          useValue: registrationService,
        },

        {
          provide: AccountLocalLoginService,
          useValue: loginService,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();

    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('registers a local Account and sets the HttpOnly session cookie', async () => {
    registrationService.register.mockResolvedValue(createAuthResult());

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        loginId: 'Cesar.MMO',
        password: 'StrongPassword123!',
      })
      .expect(201);

    expect(registrationService.register).toHaveBeenCalledWith({
      loginId: 'Cesar.MMO',
      password: 'StrongPassword123!',
    });

    expect(response.body).toEqual({
      authenticated: true,
      account: {
        accountId: ACCOUNT_ID,
        provider: 'LOCAL',
        email: null,
      },
      session: {
        expiresAt: SESSION_EXPIRES_AT.toISOString(),
      },
    });

    expect(JSON.stringify(response.body)).not.toContain(SESSION_TOKEN);

    expect(response.body.account).not.toHaveProperty('providerUserId');

    const cookies = response.headers['set-cookie'];

    expect(cookies).toBeDefined();

    expect(cookies.join(';')).toContain(`${ACCOUNT_SESSION_COOKIE_NAME}=`);

    expect(cookies.join(';')).toContain('HttpOnly');
  });

  it('logs in a local Account and sets the same AccountSession cookie', async () => {
    loginService.login.mockResolvedValue(createAuthResult());

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        loginId: 'cesar.mmo',

        password: 'StrongPassword123!',
      })
      .expect(200);

    expect(response.body.authenticated).toBe(true);

    expect(response.body.account.provider).toBe('LOCAL');

    expect(response.headers['set-cookie'].join(';')).toContain(
      `${ACCOUNT_SESSION_COOKIE_NAME}=`,
    );
  });

  it('returns 409 when the local Account already exists', async () => {
    registrationService.register.mockRejectedValue(
      new LocalAccountRegistrationError(
        'ACCOUNT_ALREADY_EXISTS',
        'An Account with this login id already exists',
      ),
    );

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        loginId: 'cesar',
        password: 'StrongPassword123!',
      })
      .expect(409);
  });

  it('returns 400 for invalid registration input', async () => {
    registrationService.register.mockRejectedValue(
      new LocalAccountRegistrationError('INVALID_LOGIN_ID', 'Invalid login id'),
    );

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        loginId: '??',
        password: 'StrongPassword123!',
      })
      .expect(400);
  });

  it('returns the same 401 response for invalid local credentials', async () => {
    loginService.login.mockRejectedValue(
      new LocalAccountLoginError('INVALID_CREDENTIALS'),
    );

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        loginId: 'unknown',
        password: 'WrongPassword123!',
      })
      .expect(401);

    expect(response.body.message).toBe('Invalid login id or password');
  });
});
