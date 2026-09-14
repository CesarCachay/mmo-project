import { describe, expect, it, vi } from 'vitest';

import { AccountService } from '../account.service';

import type { AccountRepository } from '../account.repository';
import type { AccountRecord } from '../account.types';

const account: AccountRecord = {
  accountId: '11111111-1111-4111-8111-111111111111',
  provider: 'GOOGLE',
  providerUserId: 'google-user-123',
  email: 'trainer@example.com',
  createdAt: new Date('2026-09-12T00:00:00.000Z'),
  updatedAt: new Date('2026-09-12T00:00:00.000Z'),
};

describe('AccountService', () => {
  it('resolves an Account through provider identity', async () => {
    const upsertByProviderIdentity = vi.fn(() => Promise.resolve(account));

    const repository = {
      upsertByProviderIdentity,
    } as unknown as AccountRepository;

    const service = new AccountService(repository);

    const result = await service.resolveProviderAccount({
      provider: 'GOOGLE',
      providerUserId: 'google-user-123',
      email: 'trainer@example.com',
    });

    expect(result).toBe(account);

    expect(upsertByProviderIdentity).toHaveBeenCalledWith({
      provider: 'GOOGLE',
      providerUserId: 'google-user-123',
      email: 'trainer@example.com',
    });
  });

  it('normalizes provider user id whitespace and email casing', async () => {
    const upsertByProviderIdentity = vi.fn(() => Promise.resolve(account));

    const repository = {
      upsertByProviderIdentity,
    } as unknown as AccountRepository;

    const service = new AccountService(repository);

    await service.resolveProviderAccount({
      provider: 'GOOGLE',
      providerUserId: '  google-user-123  ',
      email: '  TRAINER@EXAMPLE.COM  ',
    });

    expect(upsertByProviderIdentity).toHaveBeenCalledWith({
      provider: 'GOOGLE',
      providerUserId: 'google-user-123',
      email: 'trainer@example.com',
    });
  });

  it('does not erase persisted email when provider does not supply one', async () => {
    const upsertByProviderIdentity = vi.fn(() => Promise.resolve(account));

    const repository = {
      upsertByProviderIdentity,
    } as unknown as AccountRepository;

    const service = new AccountService(repository);

    await service.resolveProviderAccount({
      provider: 'GOOGLE',
      providerUserId: 'google-user-123',
    });

    expect(upsertByProviderIdentity).toHaveBeenCalledWith({
      provider: 'GOOGLE',
      providerUserId: 'google-user-123',
    });
  });

  it('rejects an empty provider user id', async () => {
    const upsertByProviderIdentity = vi.fn();

    const repository = {
      upsertByProviderIdentity,
    } as unknown as AccountRepository;

    const service = new AccountService(repository);

    await expect(
      service.resolveProviderAccount({
        provider: 'GOOGLE',
        providerUserId: '   ',
        email: 'trainer@example.com',
      }),
    ).rejects.toThrow('Account provider user id is required');

    expect(upsertByProviderIdentity).not.toHaveBeenCalled();
  });
});
