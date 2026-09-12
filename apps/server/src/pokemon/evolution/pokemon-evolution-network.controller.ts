import type { Socket } from 'socket.io';

import {
  POKEMON_EVENTS,
  isPokemonEvolutionDecisionInput,
} from '@cesar-mmo/shared';

import type {
  PokemonEvolutionErrorPayload,
  PokemonEvolutionRequiredPayload,
  PokemonEvolutionResolvedPayload,
} from '@cesar-mmo/shared';

import type { PokemonTrainerId } from '../pokemon-trainer-identity';

import { PokemonTrainerStateNetworkPresenter } from '../network/PokemonTrainerStateNetworkPresenter';

import { PokemonProgressionManager } from '../progression/pokemon-progression.manager';

import { PokemonEvolutionDecisionError } from './pokemon-evolution-decision.service';

import type { PokemonPendingEvolutionState } from './pokemon-pending-evolution.types';

export interface PokemonEvolutionNetworkControllerOptions {
  readonly progressionManager: PokemonProgressionManager;
  readonly trainerStatePresenter: PokemonTrainerStateNetworkPresenter;
  readonly resolveTrainerId: (playerId: string) => PokemonTrainerId | undefined;
}

/*
 * ---------------------------------------------------------
 * Outbound EVOLUTION_REQUIRED presenter
 * ---------------------------------------------------------
 *
 * Kept outside GameGateway and reusable by:
 *
 * - Battle progression
 * - final Move Learning continuation
 * - reconnect restoration
 */
export function emitPokemonEvolutionRequired(
  client: Socket,
  pending: PokemonPendingEvolutionState,
): void {
  client.emit(POKEMON_EVENTS.EVOLUTION_REQUIRED, {
    pokemonInstanceId: pending.pokemonInstanceId,
    sourceSpeciesId: pending.sourceSpeciesId,
    sourceFormId: pending.sourceFormId,
    targetSpeciesId: pending.targetSpeciesId,
    targetFormId: pending.targetFormId,
    triggerLevel: pending.triggerLevel,
    revision: pending.revision,
  } satisfies PokemonEvolutionRequiredPayload);
}

export class PokemonEvolutionNetworkController {
  private readonly progressionManager: PokemonProgressionManager;
  private readonly trainerStatePresenter: PokemonTrainerStateNetworkPresenter;
  private readonly resolveTrainerId: PokemonEvolutionNetworkControllerOptions['resolveTrainerId'];

  constructor(options: PokemonEvolutionNetworkControllerOptions) {
    this.progressionManager = options.progressionManager;
    this.trainerStatePresenter = options.trainerStatePresenter;
    this.resolveTrainerId = options.resolveTrainerId;
  }

  /*
   * -------------------------------------------------------
   * Client → Server
   *
   * EVOLUTION_DECISION
   * -------------------------------------------------------
   */
  public async handleEvolutionDecision(
    client: Socket,
    payload: unknown,
  ): Promise<void> {
    if (!isPokemonEvolutionDecisionInput(payload)) {
      return;
    }

    const trainerId = this.resolveTrainerId(client.id);

    if (!trainerId) {
      this.emitError(
        client,
        payload.pokemonInstanceId,
        payload.revision,
        'TRAINER_NOT_FOUND',
        'Pokémon Trainer identity not found.',
      );

      return;
    }

    try {
      const result = await this.progressionManager.resolveEvolutionDecision({
        trainerId,
        pokemonInstanceId: payload.pokemonInstanceId,
        decision: payload.decision,
        expectedRevision: payload.revision,
      });

      /*
       * DB has already committed and the runtime
       * TrainerState has already been updated by the
       * EvolutionDecisionService.
       */
      this.trainerStatePresenter.emitTrainerState(client, result.trainerState);

      const evolution = result.evolution
        ? {
            pokemonInstanceId: result.evolution.pokemonInstanceId,
            previousSpeciesId: result.evolution.sourceSpeciesId,
            previousFormId: result.evolution.sourceFormId,
            currentSpeciesId: result.evolution.targetSpeciesId,
            currentFormId: result.evolution.targetFormId,
          }
        : null;

      client.emit(POKEMON_EVENTS.EVOLUTION_RESOLVED, {
        pokemonInstanceId: payload.pokemonInstanceId,
        resolvedRevision: payload.revision,
        decision: result.decision,
        evolution,
      } satisfies PokemonEvolutionResolvedPayload);
    } catch (error: unknown) {
      const code =
        error instanceof PokemonEvolutionDecisionError
          ? error.code
          : 'EVOLUTION_FAILED';

      const message =
        error instanceof Error
          ? error.message
          : 'Failed to resolve Pokémon evolution.';

      this.emitError(
        client,
        payload.pokemonInstanceId,
        payload.revision,
        code,
        message,
      );
    }
  }

  private emitError(
    client: Socket,
    pokemonInstanceId: string | null,
    revision: number | null,
    code: string,
    message: string,
  ): void {
    client.emit(POKEMON_EVENTS.EVOLUTION_ERROR, {
      pokemonInstanceId,
      revision,
      code,
      message,
    } satisfies PokemonEvolutionErrorPayload);
  }
}
