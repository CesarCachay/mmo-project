import { describe, expect, it } from 'vitest';

import { PasswordHasherService } from '#app/account/local/password-hasher.service';

describe('PasswordHasherService', () => {
  const service = new PasswordHasherService();

  it('hashes a password without storing the raw value', async () => {
    const password = 'Cesar-MMO-123!';

    const hash = await service.hash(password);

    expect(hash).not.toBe(password);

    expect(hash).toContain('argon2id');
  });

  it('verifies the correct password and rejects a wrong password', async () => {
    const password = 'Cesar-MMO-123!';

    const hash = await service.hash(password);

    await expect(service.verify(hash, password)).resolves.toBe(true);

    await expect(service.verify(hash, 'Wrong-Password!')).resolves.toBe(false);
  });

  it('rejects an invalid persisted hash', async () => {
    await expect(
      service.verify('not-an-argon2-hash', 'password'),
    ).resolves.toBe(false);
  });
});
