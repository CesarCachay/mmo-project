export type AccountId = string;

export type AccountProvider = 'GOOGLE' | 'LOCAL';

export interface AccountRecord {
  readonly accountId: AccountId;
  readonly provider: AccountProvider;
  readonly providerUserId: string;
  readonly email: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface AccountProviderIdentity {
  readonly provider: AccountProvider;
  readonly providerUserId: string;
}

export interface CreateAccountInput extends AccountProviderIdentity {
  readonly email?: string | null;
}

export interface ResolveAccountInput extends AccountProviderIdentity {
  readonly email?: string | null;
}
