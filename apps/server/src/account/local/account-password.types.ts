import type { AccountId } from '../account.types';

export interface AccountPasswordCredentialRecord {
  readonly accountId: AccountId;
  readonly passwordHash: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateAccountPasswordCredentialInput {
  readonly accountId: AccountId;
  readonly passwordHash: string;
}
