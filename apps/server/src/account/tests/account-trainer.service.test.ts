import { describe, expect, it, vi } from 'vitest';

import { AccountTrainerService } from '../account-trainer.service';

import type { AccountRepository } from '../account.repository';
import type { AccountTrainerRepository } from '../account-trainer.repository';

import type { AccountRecord } from '../account.types';
import type { AccountTrainerRecord } from '../account-trainer.types';

const accountId = '11111111-1111-4111-8111-111111111111';

const account: AccountRecord = {
  accountId,
  provider: 'GOOGLE',
  providerUserId: 'google-user-123',
  email: 'trainer@example.com',
  createdAt: new Date('2026-09-12T00:00:00.000Z'),
  updatedAt: new Date('2026-09-12T00:00:00.000Z'),
};

const trainer: AccountTrainerRecord = {
  trainerId: '22222222-2222-4222-8222-222222222222',
  accountId,

  displayName: 'Cesar',
  avatarId: 'male-01',

  createdAt: new Date('2026-09-12T00:00:00.000Z'),
  updatedAt: new Date('2026-09-12T00:00:00.000Z'),
};

describe('AccountTrainerService', () => {
  it('lists Trainers owned by an existing Account', async () => {
    const findById = vi.fn(() => Promise.resolve(account));

    const findByAccountId = vi.fn(() => Promise.resolve([trainer]));

    const accountRepository = {
      findById,
    } as unknown as AccountRepository;

    const accountTrainerRepository = {
      findByAccountId,
    } as unknown as AccountTrainerRepository;

    const service = new AccountTrainerService(
      accountRepository,
      accountTrainerRepository,
    );

    const result = await service.listTrainers(accountId);

    expect(result).toEqual([trainer]);

    expect(findById).toHaveBeenCalledWith(accountId);

    expect(findByAccountId).toHaveBeenCalledWith(accountId);
  });

  it('rejects ownership operations for a missing Account', async () => {
    const findById = vi.fn(() => Promise.resolve(undefined));

    const findByAccountId = vi.fn();

    const accountRepository = {
      findById,
    } as unknown as AccountRepository;

    const accountTrainerRepository = {
      findByAccountId,
    } as unknown as AccountTrainerRepository;

    const service = new AccountTrainerService(
      accountRepository,
      accountTrainerRepository,
    );

    await expect(service.listTrainers(accountId)).rejects.toThrow(
      `Account "${accountId}" does not exist`,
    );

    expect(findById).toHaveBeenCalledWith(accountId);

    expect(findByAccountId).not.toHaveBeenCalled();
  });

  it('checks Trainer ownership', async () => {
    const belongsToAccount = vi.fn(() => Promise.resolve(true));

    const accountRepository = {} as AccountRepository;

    const accountTrainerRepository = {
      belongsToAccount,
    } as unknown as AccountTrainerRepository;

    const service = new AccountTrainerService(
      accountRepository,
      accountTrainerRepository,
    );

    const result = await service.ownsTrainer(accountId, trainer.trainerId);

    expect(result).toBe(true);

    expect(belongsToAccount).toHaveBeenCalledWith(accountId, trainer.trainerId);
  });

  it('creates an Account-owned Trainer with normalized profile', async () => {
    const findById = vi.fn(() => Promise.resolve(account));

    type CreateOwnedTrainerInput = Parameters<
      AccountTrainerRepository['createOwnedTrainer']
    >[0];

    const createOwnedTrainer =
      vi.fn<
        (input: CreateOwnedTrainerInput) => Promise<AccountTrainerRecord>
      >();

    createOwnedTrainer.mockResolvedValue(trainer);

    const accountRepository = {
      findById,
    } as unknown as AccountRepository;

    const accountTrainerRepository = {
      createOwnedTrainer,
    } as unknown as AccountTrainerRepository;

    const service = new AccountTrainerService(
      accountRepository,
      accountTrainerRepository,
    );

    const result = await service.createTrainer({
      accountId,
      displayName: '  Cesar  ',
      avatarId: 'male-01',
    });

    expect(result).toBe(trainer);

    expect(findById).toHaveBeenCalledWith(accountId);

    expect(createOwnedTrainer).toHaveBeenCalledTimes(1);

    expect(createOwnedTrainer).toHaveBeenCalledTimes(1);

    const persistenceInput = createOwnedTrainer.mock.calls[0]?.[0];

    expect(persistenceInput).toBeDefined();

    if (!persistenceInput) {
      throw new Error('Expected createOwnedTrainer to receive an input');
    }

    expect(persistenceInput.accountId).toBe(accountId);
    expect(persistenceInput.displayName).toBe('Cesar');
    expect(persistenceInput.avatarId).toBe('male-01');

    expect(typeof persistenceInput.trainerId).toBe('string');
    expect(persistenceInput.trainerId.length).toBeGreaterThan(0);
  });

  it('rejects a Trainer display name longer than 16 characters', async () => {
    const findById = vi.fn(() => Promise.resolve(account));
    const createOwnedTrainer = vi.fn();

    const accountRepository = {
      findById,
    } as unknown as AccountRepository;

    const accountTrainerRepository = {
      createOwnedTrainer,
    } as unknown as AccountTrainerRepository;

    const service = new AccountTrainerService(
      accountRepository,
      accountTrainerRepository,
    );

    await expect(
      service.createTrainer({
        accountId,
        displayName: '12345678901234567',
        avatarId: 'female-01',
      }),
    ).rejects.toThrow(
      'Trainer display name must contain between 3 and 16 characters',
    );

    expect(createOwnedTrainer).not.toHaveBeenCalled();
  });
});
