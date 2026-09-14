import { createHash, randomBytes } from 'node:crypto';

import {
  ACCOUNT_SESSION_TOKEN_PREFIX,
  ACCOUNT_SESSION_TOKEN_RANDOM_BYTES,
} from './account-session.constants';

import type { AccountSessionToken } from './account-session.types';

export function createAccountSessionToken(): AccountSessionToken {
  const secret = randomBytes(ACCOUNT_SESSION_TOKEN_RANDOM_BYTES).toString(
    'base64url',
  );

  return `${ACCOUNT_SESSION_TOKEN_PREFIX}${secret}`;
}

export function hashAccountSessionToken(token: AccountSessionToken): string {
  return createHash('sha256').update(token).digest('hex');
}

export function isAccountSessionToken(
  value: unknown,
): value is AccountSessionToken {
  if (typeof value !== 'string') {
    return false;
  }

  const pattern = /^accs_[A-Za-z0-9_-]{43}$/;

  return pattern.test(value);
}
