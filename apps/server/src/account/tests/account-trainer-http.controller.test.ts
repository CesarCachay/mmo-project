import { UnauthorizedException, type INestApplication } from '@nestjs/common';

import { Test } from '@nestjs/testing';

import type { Server } from 'node:http';

import request from 'supertest';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AccountRequestAuthenticationService } from '../account-request-authentication.service';

import { AccountTrainerHttpController } from '../account-trainer-http.controller';

import { AccountTrainerService } from '../account-trainer.service';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';

const TRAINER_ID = '22222222-2222-4222-8222-222222222222';

const CREATED_AT = new Date('2026-09-13T12:00:00.000Z');

const UPDATED_AT = new Date('2026-09-13T13:00:00.000Z');

describe('AccountTrainerHttpController', () => {
  let app: INestApplication | null = null;

  let httpServer: Server | null = null;

  const requestAuthenticationService = {
    requireAuthenticatedAccount: vi.fn(),
  };

  const accountTrainerService = {
    listTrainers: vi.fn(),
    createTrainer: vi.fn(),
  };

  function requireHttpServer(): Server {
    if (!httpServer) {
      throw new Error('Nest HTTP server was not initialized');
    }

    return httpServer;
  }

  beforeEach(async () => {
    vi.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [AccountTrainerHttpController],

      providers: [
        {
          provide: AccountRequestAuthenticationService,

          useValue: requestAuthenticationService,
        },

        {
          provide: AccountTrainerService,

          useValue: accountTrainerService,
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

  it('returns only trainers owned by the authenticated account', async () => {
    requestAuthenticationService.requireAuthenticatedAccount.mockResolvedValue({
      account: {
        accountId: ACCOUNT_ID,
        provider: 'GOOGLE',
        providerUserId: 'google-user-123',
        email: 'cesar@example.com',
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },

      session: {
        sessionId: '33333333-3333-4333-8333-333333333333',
        accountId: ACCOUNT_ID,
        expiresAt: new Date('2026-10-13T12:00:00.000Z'),
        revokedAt: null,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
    });

    accountTrainerService.listTrainers.mockResolvedValue([
      {
        trainerId: TRAINER_ID,

        accountId: ACCOUNT_ID,

        displayName: 'Cesar',

        avatarId: 'male-01',

        createdAt: CREATED_AT,

        updatedAt: UPDATED_AT,
      },
    ]);

    const response = await request(requireHttpServer())
      .get('/trainers')
      .expect(200);

    expect(accountTrainerService.listTrainers).toHaveBeenCalledTimes(1);

    expect(accountTrainerService.listTrainers).toHaveBeenCalledWith(ACCOUNT_ID);

    expect(response.body).toEqual({
      trainers: [
        {
          trainerId: TRAINER_ID,

          displayName: 'Cesar',

          avatarId: 'male-01',

          createdAt: CREATED_AT.toISOString(),

          updatedAt: UPDATED_AT.toISOString(),
        },
      ],
    });

    expect(response.body).not.toHaveProperty('trainers.0.accountId');
  });

  it('returns an empty list when the account has no trainers', async () => {
    requestAuthenticationService.requireAuthenticatedAccount.mockResolvedValue({
      account: {
        accountId: ACCOUNT_ID,
      },
    });

    accountTrainerService.listTrainers.mockResolvedValue([]);

    const response = await request(requireHttpServer())
      .get('/trainers')
      .expect(200);

    expect(response.body).toEqual({
      trainers: [],
    });
  });

  it('returns 401 when the account is not authenticated', async () => {
    requestAuthenticationService.requireAuthenticatedAccount.mockRejectedValue(
      new UnauthorizedException(),
    );

    await request(requireHttpServer()).get('/trainers').expect(401);

    expect(accountTrainerService.listTrainers).not.toHaveBeenCalled();
  });

  describe('POST /trainers', () => {
    it('creates a trainer for the authenticated account', async () => {
      requestAuthenticationService.requireAuthenticatedAccount.mockResolvedValue(
        {
          account: {
            accountId: ACCOUNT_ID,
          },
        },
      );

      accountTrainerService.createTrainer.mockResolvedValue({
        trainerId: TRAINER_ID,

        accountId: ACCOUNT_ID,

        displayName: 'Cesar',

        avatarId: 'male-01',

        createdAt: CREATED_AT,

        updatedAt: UPDATED_AT,
      });

      const response = await request(requireHttpServer())
        .post('/trainers')
        .send({
          accountId: '99999999-9999-4999-8999-999999999999',

          displayName: '  Cesar  ',

          avatarId: 'male-01',
        })
        .expect(201);

      expect(accountTrainerService.createTrainer).toHaveBeenCalledWith({
        accountId: ACCOUNT_ID,

        displayName: 'Cesar',

        avatarId: 'male-01',
      });

      expect(response.body).toEqual({
        trainer: {
          trainerId: TRAINER_ID,

          displayName: 'Cesar',

          avatarId: 'male-01',

          createdAt: CREATED_AT.toISOString(),

          updatedAt: UPDATED_AT.toISOString(),
        },
      });

      expect(response.body).not.toHaveProperty('trainer.accountId');
    });

    it('returns 400 for an invalid trainer name', async () => {
      requestAuthenticationService.requireAuthenticatedAccount.mockResolvedValue(
        {
          account: {
            accountId: ACCOUNT_ID,
          },
        },
      );

      await request(requireHttpServer())
        .post('/trainers')
        .send({
          displayName: 'ab',

          avatarId: 'male-01',
        })
        .expect(400);

      expect(accountTrainerService.createTrainer).not.toHaveBeenCalled();
    });

    it('returns 400 for an invalid avatar', async () => {
      requestAuthenticationService.requireAuthenticatedAccount.mockResolvedValue(
        {
          account: {
            accountId: ACCOUNT_ID,
          },
        },
      );

      await request(requireHttpServer())
        .post('/trainers')
        .send({
          displayName: 'Cesar',

          avatarId: 'admin-avatar',
        })
        .expect(400);

      expect(accountTrainerService.createTrainer).not.toHaveBeenCalled();
    });

    it('returns 401 when the account is not authenticated', async () => {
      requestAuthenticationService.requireAuthenticatedAccount.mockRejectedValue(
        new UnauthorizedException(),
      );

      await request(requireHttpServer())
        .post('/trainers')
        .send({
          displayName: 'Cesar',

          avatarId: 'male-01',
        })
        .expect(401);

      expect(accountTrainerService.createTrainer).not.toHaveBeenCalled();
    });

    it('returns 409 when the account already owns the maximum number of trainers', async () => {
      requestAuthenticationService.requireAuthenticatedAccount.mockResolvedValue(
        {
          account: {
            accountId: ACCOUNT_ID,
          },
        },
      );

      accountTrainerService.createTrainer.mockRejectedValue(
        Object.assign(new Error('An Account can own at most 3 Trainers'), {
          code: 'TRAINER_LIMIT_REACHED',
        }),
      );

      await request(requireHttpServer())
        .post('/trainers')
        .send({
          displayName: 'Trainer4',

          avatarId: 'female-01',
        })
        .expect(409);
    });
  });
});
