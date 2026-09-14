import type { AccountRecord } from '../account.types';

import type {
  AccountSessionRecord,
  AccountSessionToken,
} from '../account-session.types';

export type LocalAccountRecord = Omit<AccountRecord, 'provider'> & {
  readonly provider: 'LOCAL';
};

export interface RegisterLocalAccountInput {
  readonly loginId: string;
  readonly password: string;
}

export interface RegisterLocalAccountResult {
  readonly account: LocalAccountRecord;
  readonly session: AccountSessionRecord;
  readonly token: AccountSessionToken;
}

export interface LoginLocalAccountInput {
  readonly loginId: string;
  readonly password: string;
}

export interface LoginLocalAccountResult {
  readonly account: LocalAccountRecord;
  readonly session: AccountSessionRecord;
  readonly token: AccountSessionToken;
}

export interface CreateLocalAccountPersistenceInput {
  readonly loginId: string;
  readonly passwordHash: string;
}
