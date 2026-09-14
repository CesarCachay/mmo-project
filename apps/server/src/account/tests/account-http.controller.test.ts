import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AccountAuthenticationService } from '../account-authentication.service';
import { AccountHttpController } from '../account-http.controller';
import { ACCOUNT_SESSION_COOKIE_NAME } from '../account-session-cookie';
import { AccountSessionService } from '../account-session.service';
import { AccountGoogleLoginService } from '../google/account-google-login.service';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';

const SESSION_ID = '22222222-2222-4222-8222-222222222222';

const SESSION_TOKEN = `accs_${'a'.repeat(43)}`;

const SESSION_COOKIE = `${ACCOUNT_SESSION_COOKIE_NAME}=${SESSION_TOKEN}`;

const SESSION_EXPIRES_AT = new Date('2026-10-13T12:00:00.000Z');

const googleLoginService = {
  login: vi.fn(),
};

describe('AccountHttpController', () => {
  let app: INestApplication | null = null;
  let httpServer: Server | null = null;

  const authenticationService = {
    resolveAuthenticatedAccount: vi.fn(),
  };

  const sessionService = {
    revokeSession: vi.fn(),
  };

  function requireHttpServer(): Server {
    if (!httpServer) {
      throw new Error('Nest HTTP server was not initialized');
    }

    return httpServer;
  }

  beforeEach(async () => {
    vi.clearAllMocks();

    app = null;
    httpServer = null;

    const moduleRef = await Test.createTestingModule({
      controllers: [AccountHttpController],

      providers: [
        {
          provide: AccountAuthenticationService,
          useValue: authenticationService,
        },

        {
          provide: AccountSessionService,
          useValue: sessionService,
        },
        {
          provide: AccountGoogleLoginService,
          useValue: googleLoginService,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();

    await app.init();

    httpServer = app.getHttpServer() as Server;
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }

    app = null;
    httpServer = null;
  });

  describe('GET /auth/session', () => {
    it('returns the authenticated account for an active session cookie', async () => {
      authenticationService.resolveAuthenticatedAccount.mockResolvedValue({
        account: {
          accountId: ACCOUNT_ID,
          provider: 'GOOGLE',
          providerUserId: 'google-user-123',
          email: 'cesar@example.com',
          createdAt: new Date('2026-09-13T12:00:00.000Z'),
          updatedAt: new Date('2026-09-13T12:00:00.000Z'),
        },

        session: {
          sessionId: SESSION_ID,
          accountId: ACCOUNT_ID,
          expiresAt: SESSION_EXPIRES_AT,
          revokedAt: null,
          createdAt: new Date('2026-09-13T12:00:00.000Z'),
          updatedAt: new Date('2026-09-13T12:00:00.000Z'),
        },
      });

      const response = await request(requireHttpServer())
        .get('/auth/session')
        .set('Cookie', SESSION_COOKIE)
        .expect(200);

      expect(
        authenticationService.resolveAuthenticatedAccount,
      ).toHaveBeenCalledTimes(1);

      expect(
        authenticationService.resolveAuthenticatedAccount,
      ).toHaveBeenCalledWith(SESSION_TOKEN);

      expect(response.body).toEqual({
        authenticated: true,

        account: {
          accountId: ACCOUNT_ID,
          provider: 'GOOGLE',
          email: 'cesar@example.com',
        },

        session: {
          expiresAt: SESSION_EXPIRES_AT.toISOString(),
        },
      });
    });

    it('does not expose provider identity or session secrets', async () => {
      authenticationService.resolveAuthenticatedAccount.mockResolvedValue({
        account: {
          accountId: ACCOUNT_ID,
          provider: 'GOOGLE',
          providerUserId: 'google-secret-provider-id',
          email: 'cesar@example.com',
          createdAt: new Date(),
          updatedAt: new Date(),
        },

        session: {
          sessionId: SESSION_ID,
          accountId: ACCOUNT_ID,
          expiresAt: SESSION_EXPIRES_AT,
          revokedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const response = await request(requireHttpServer())
        .get('/auth/session')
        .set('Cookie', SESSION_COOKIE)
        .expect(200);

      expect(response.body).not.toHaveProperty('account.providerUserId');

      expect(response.body).not.toHaveProperty('session.sessionId');

      expect(JSON.stringify(response.body)).not.toContain(SESSION_TOKEN);
    });

    it('returns 401 when there is no authenticated session', async () => {
      authenticationService.resolveAuthenticatedAccount.mockResolvedValue(
        undefined,
      );

      await request(requireHttpServer()).get('/auth/session').expect(401);

      expect(
        authenticationService.resolveAuthenticatedAccount,
      ).toHaveBeenCalledTimes(1);

      expect(
        authenticationService.resolveAuthenticatedAccount,
      ).toHaveBeenCalledWith(undefined);
    });

    it('ignores a malformed account session cookie', async () => {
      authenticationService.resolveAuthenticatedAccount.mockResolvedValue(
        undefined,
      );

      await request(requireHttpServer())
        .get('/auth/session')
        .set('Cookie', `${ACCOUNT_SESSION_COOKIE_NAME}=invalid-token`)
        .expect(401);

      expect(
        authenticationService.resolveAuthenticatedAccount,
      ).toHaveBeenCalledTimes(1);

      expect(
        authenticationService.resolveAuthenticatedAccount,
      ).toHaveBeenCalledWith(undefined);
    });
  });

  describe('POST /auth/logout', () => {
    it('revokes the current session and clears the cookie', async () => {
      sessionService.revokeSession.mockResolvedValue(true);

      const response = await request(requireHttpServer())
        .post('/auth/logout')
        .set('Cookie', SESSION_COOKIE)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
      });

      expect(sessionService.revokeSession).toHaveBeenCalledTimes(1);

      expect(sessionService.revokeSession).toHaveBeenCalledWith(SESSION_TOKEN);

      const setCookieHeader = response.headers['set-cookie'];

      expect(setCookieHeader).toBeDefined();

      const setCookies = Array.isArray(setCookieHeader)
        ? setCookieHeader
        : [setCookieHeader];

      const serializedCookies = setCookies.join(';');

      expect(serializedCookies).toContain(`${ACCOUNT_SESSION_COOKIE_NAME}=`);

      expect(serializedCookies).toContain('HttpOnly');
    });

    it('is idempotent when there is no session cookie', async () => {
      const response = await request(requireHttpServer())
        .post('/auth/logout')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
      });

      expect(sessionService.revokeSession).not.toHaveBeenCalled();

      expect(response.headers['set-cookie']).toBeDefined();
    });
  });

  describe('POST /auth/google', () => {
    it('creates an authenticated account session and sets the session cookie', async () => {
      googleLoginService.login.mockResolvedValue({
        account: {
          accountId: ACCOUNT_ID,
          provider: 'GOOGLE',
          providerUserId: 'google-user-123',
          email: 'cesar@example.com',
          createdAt: new Date('2026-09-13T12:00:00.000Z'),
          updatedAt: new Date('2026-09-13T12:00:00.000Z'),
        },

        session: {
          sessionId: SESSION_ID,
          accountId: ACCOUNT_ID,
          expiresAt: SESSION_EXPIRES_AT,
          revokedAt: null,
          createdAt: new Date('2026-09-13T12:00:00.000Z'),
          updatedAt: new Date('2026-09-13T12:00:00.000Z'),
        },

        token: SESSION_TOKEN,
      });

      const response = await request(requireHttpServer())
        .post('/auth/google')
        .send({
          credential: 'google-id-token',
        })
        .expect(200);

      expect(googleLoginService.login).toHaveBeenCalledWith('google-id-token');

      expect(response.body).toEqual({
        authenticated: true,

        account: {
          accountId: ACCOUNT_ID,
          provider: 'GOOGLE',
          email: 'cesar@example.com',
        },

        session: {
          expiresAt: SESSION_EXPIRES_AT.toISOString(),
        },
      });

      expect(response.body).not.toHaveProperty('token');

      expect(response.body).not.toHaveProperty('account.providerUserId');

      const setCookieHeader = response.headers['set-cookie'];

      expect(setCookieHeader).toBeDefined();

      const setCookies = Array.isArray(setCookieHeader)
        ? setCookieHeader
        : [setCookieHeader];

      const serializedCookies = setCookies.join(';');

      expect(serializedCookies).toContain(`${ACCOUNT_SESSION_COOKIE_NAME}=`);

      expect(serializedCookies).toContain('HttpOnly');

      expect(serializedCookies).toContain(SESSION_TOKEN);
    });

    it('returns 401 when Google authentication fails', async () => {
      googleLoginService.login.mockRejectedValue(
        new UnauthorizedException('Invalid Google credential'),
      );

      await request(requireHttpServer())
        .post('/auth/google')
        .send({
          credential: 'invalid-google-token',
        })
        .expect(401);
    });
  });
});
