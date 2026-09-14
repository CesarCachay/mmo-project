import { Injectable } from '@nestjs/common';

import { isPlayerAvatarId } from '@cesar-mmo/shared';

import { createPokemonTrainerId } from '../pokemon/pokemon-trainer-identity';

import type { PokemonTrainerId } from '../pokemon/pokemon-trainer-identity';

import { AccountRepository } from './account.repository';
import { AccountTrainerRepository } from './account-trainer.repository';

import type { AccountId } from './account.types';

import type {
  AccountTrainerRecord,
  CreateAccountTrainerInput,
} from './account-trainer.types';

@Injectable()
export class AccountTrainerService {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly accountTrainerRepository: AccountTrainerRepository,
  ) {}

  async listTrainers(
    accountId: AccountId,
  ): Promise<readonly AccountTrainerRecord[]> {
    await this.requireAccount(accountId);

    return this.accountTrainerRepository.findByAccountId(accountId);
  }

  async ownsTrainer(
    accountId: AccountId,
    trainerId: PokemonTrainerId,
  ): Promise<boolean> {
    return this.accountTrainerRepository.belongsToAccount(accountId, trainerId);
  }

  private async requireAccount(accountId: AccountId): Promise<void> {
    const account = await this.accountRepository.findById(accountId);

    if (!account) {
      throw new Error(`Account "${accountId}" does not exist`);
    }
  }

  async createTrainer(
    input: CreateAccountTrainerInput,
  ): Promise<AccountTrainerRecord> {
    await this.requireAccount(input.accountId);

    const displayName = input.displayName.trim();

    if (displayName.length < 3 || displayName.length > 16) {
      throw new Error(
        'Trainer display name must contain between 3 and 16 characters',
      );
    }

    if (!isPlayerAvatarId(input.avatarId)) {
      throw new Error('Invalid Trainer avatar');
    }

    const trainerId = createPokemonTrainerId();

    return this.accountTrainerRepository.createOwnedTrainer({
      trainerId,
      accountId: input.accountId,
      displayName,
      avatarId: input.avatarId,
    });
  }
}
