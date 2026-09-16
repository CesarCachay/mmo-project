import { Injectable } from '@nestjs/common';

import { planPokemonCenterHealing } from '@cesar-mmo/shared';

import type { PokemonTrainerState } from '@cesar-mmo/shared';

import type { PokemonTrainerId } from '../pokemon-trainer-identity';

import { PokemonTrainerStateStore } from '../pokemon-trainer-state.store';

import {
  PokemonCenterHealingPersistenceConflictError,
  PokemonCenterHealingRepository,
} from './pokemon-center-healing.repository';

import { PokemonCenterHealingOperationQueue } from './pokemon-center-healing-operation.queue';

export type PokemonCenterHealingErrorCode =
  'TRAINER_STATE_NOT_FOUND' | 'PERSISTENCE_CONFLICT' | 'PERSISTENCE_FAILED';

export class PokemonCenterHealingError extends Error {
  constructor(
    public readonly code: PokemonCenterHealingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PokemonCenterHealingError';
  }
}

export interface PokemonCenterHealingResult {
  readonly trainerState: PokemonTrainerState;
  readonly restoredPokemonCount: number;
  readonly totalHpRestored: number;
  readonly totalPpRestored: number;
}

@Injectable()
export class PokemonCenterHealingService {
  constructor(
    private readonly trainerStateStore: PokemonTrainerStateStore,
    private readonly repository: PokemonCenterHealingRepository,
    private readonly operationQueue: PokemonCenterHealingOperationQueue,
  ) {}

  public healParty(
    trainerId: PokemonTrainerId,
  ): Promise<PokemonCenterHealingResult> {
    return this.operationQueue.enqueue(trainerId, () =>
      this.executeHealParty(trainerId),
    );
  }

  private async executeHealParty(
    trainerId: PokemonTrainerId,
  ): Promise<PokemonCenterHealingResult> {
    /*
     * ------------------------------------------------------
     * 1. Runtime TrainerState authority
     * ------------------------------------------------------
     */

    const trainerState = this.trainerStateStore.get(trainerId);

    if (!trainerState) {
      throw new PokemonCenterHealingError(
        'TRAINER_STATE_NOT_FOUND',
        `Pokémon Trainer state not found for trainer "${trainerId}"`,
      );
    }

    /*
     * ------------------------------------------------------
     * 2. Pure healing plan
     * ------------------------------------------------------
     *
     * No PostgreSQL mutation.
     * No RAM mutation.
     */

    const healingPlan = planPokemonCenterHealing(trainerState.party);

    /*
     * ------------------------------------------------------
     * 3. Already fully healed
     * ------------------------------------------------------
     *
     * El Centro puede utilizarse aunque todo el Party
     * ya tenga HP/PP completos.
     *
     * No necesitamos escribir PostgreSQL nuevamente.
     */

    if (healingPlan.restoredPokemonCount === 0) {
      return {
        trainerState,
        restoredPokemonCount: 0,
        totalHpRestored: 0,
        totalPpRestored: 0,
      };
    }

    /*
     * ------------------------------------------------------
     * 4. PostgreSQL FIRST
     * ------------------------------------------------------
     *
     * expectedParty:
     * snapshot utilizado para calcular healing.
     *
     * healedParty:
     * estado que queremos persistir.
     */

    try {
      await this.repository.applyHealing({
        trainerId,
        expectedParty: trainerState.party,
        healedParty: healingPlan.updatedParty,
      });
    } catch (error: unknown) {
      /*
       * Optimistic concurrency conflict.
       *
       * Otro sistema modificó Party / HP / PP antes
       * de completar nuestra operación.
       */
      if (error instanceof PokemonCenterHealingPersistenceConflictError) {
        throw new PokemonCenterHealingError(
          'PERSISTENCE_CONFLICT',
          error.message,
        );
      }

      console.error('[PokemonCenterHealing] persistence failed', {
        trainerId,
        error,
      });

      throw new PokemonCenterHealingError(
        'PERSISTENCE_FAILED',
        'Failed to persist Pokémon Center healing',
      );
    }

    /*
     * ------------------------------------------------------
     * 5. RAM SECOND
     * ------------------------------------------------------
     *
     * Sólo modificamos TrainerState después de que
     * PostgreSQL haya hecho COMMIT exitosamente.
     */

    const updatedTrainerState = this.trainerStateStore.setParty(
      trainerId,
      healingPlan.updatedParty,
    );

    /*
     * ------------------------------------------------------
     * 6. Result
     * ------------------------------------------------------
     */

    return {
      trainerState: updatedTrainerState,
      restoredPokemonCount: healingPlan.restoredPokemonCount,
      totalHpRestored: healingPlan.totalHpRestored,
      totalPpRestored: healingPlan.totalPpRestored,
    };
  }
}
