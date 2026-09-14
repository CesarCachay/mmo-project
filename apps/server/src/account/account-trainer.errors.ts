import { MAX_TRAINERS_PER_ACCOUNT } from './account-trainer.constants';

export class AccountTrainerLimitError extends Error {
  readonly code = 'TRAINER_LIMIT_REACHED' as const;

  constructor() {
    super(`An Account can own at most ${MAX_TRAINERS_PER_ACCOUNT} Trainers`);

    this.name = 'AccountTrainerLimitError';
  }
}
