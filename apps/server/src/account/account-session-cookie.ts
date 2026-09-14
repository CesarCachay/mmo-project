import type { CookieOptions, Response } from 'express';

import { ACCOUNT_SESSION_TTL_MS } from './account-session.constants';

import { isAccountSessionToken } from './account-session-token';

import type { AccountSessionToken } from './account-session.types';

export const ACCOUNT_SESSION_COOKIE_NAME = 'cesar_mmo_account_session';

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function getAccountSessionTokenFromCookieHeader(
  cookieHeader: string | undefined,
): AccountSessionToken | undefined {
  if (!cookieHeader) {
    return undefined;
  }

  const cookies = cookieHeader.split(';');

  for (const cookie of cookies) {
    const separatorIndex = cookie.indexOf('=');

    if (separatorIndex < 0) {
      continue;
    }

    const name = cookie.slice(0, separatorIndex).trim();

    if (name !== ACCOUNT_SESSION_COOKIE_NAME) {
      continue;
    }

    const rawValue = cookie.slice(separatorIndex + 1).trim();

    try {
      const value = decodeURIComponent(rawValue);

      if (!isAccountSessionToken(value)) {
        return undefined;
      }

      return value;
    } catch {
      return undefined;
    }
  }

  return undefined;
}

function getAccountSessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax',
    path: '/',
    maxAge: ACCOUNT_SESSION_TTL_MS,
  };
}

function getAccountSessionCookieClearOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax',
    path: '/',
  };
}

export function setAccountSessionCookie(
  response: Response,
  token: AccountSessionToken,
): void {
  response.cookie(
    ACCOUNT_SESSION_COOKIE_NAME,
    token,
    getAccountSessionCookieOptions(),
  );
}

export function clearAccountSessionCookie(response: Response): void {
  response.clearCookie(
    ACCOUNT_SESSION_COOKIE_NAME,
    getAccountSessionCookieClearOptions(),
  );
}
