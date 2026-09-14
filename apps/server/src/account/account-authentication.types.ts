import type { AccountRecord } from './account.types';
import type { AccountSessionRecord } from './account-session.types';

export interface AuthenticatedAccountContext {
  readonly account: AccountRecord;
  readonly session: AccountSessionRecord;
}
