import type { AccountId } from './account.types';

export type AccountSessionId = string;
export type AccountSessionToken = string;

export interface AccountSessionRecord {
  readonly sessionId: AccountSessionId;
  readonly accountId: AccountId;

  readonly expiresAt: Date;
  readonly revokedAt: Date | null;

  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateAccountSessionResult {
  readonly token: AccountSessionToken;
  readonly session: AccountSessionRecord;
}
