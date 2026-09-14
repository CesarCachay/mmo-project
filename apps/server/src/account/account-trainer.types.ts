import type { PlayerAvatarId } from '@cesar-mmo/shared';

import type { AccountId } from './account.types';

export type AccountTrainerRecord = {
  trainerId: string;
  accountId: string;

  displayName: string;
  avatarId: PlayerAvatarId;

  createdAt: Date;
  updatedAt: Date;
};

export interface CreateAccountTrainerInput {
  readonly accountId: AccountId;
  readonly displayName: string;
  readonly avatarId: PlayerAvatarId;
}
