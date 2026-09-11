import type { Socket } from 'socket.io';

import {
  POKEMON_EVENTS,
  isPokemonMoveLearningDecisionInput,
} from '@cesar-mmo/shared';

import type {
  PokemonMoveLearningErrorPayload,
  PokemonMoveLearningResolvedPayload,
  PokemonEvolutionResolvedPayload,
} from '@cesar-mmo/shared';

import type { PokemonTrainerId } from '../pokemon-trainer-identity';

import { PokemonTrainerStateNetworkPresenter } from '../network/PokemonTrainerStateNetworkPresenter';

import { PokemonProgressionManager } from './pokemon-progression.manager';

import { PokemonProgressionError } from './pokemon-progression.service';

import { toPendingMoveLearningCandidate } from './pokemon-pending-move-learning.types';

export interface PokemonProgressionNetworkControllerOptions {
  readonly progressionManager: PokemonProgressionManager;
  readonly trainerStatePresenter: PokemonTrainerStateNetworkPresenter;
  readonly resolveTrainerId: (playerId: string) => PokemonTrainerId | undefined;
}

export class PokemonProgressionNetworkController {
  private readonly progressionManager: PokemonProgressionManager;
  private readonly trainerStatePresenter: PokemonTrainerStateNetworkPresenter;
  private readonly resolveTrainerId: PokemonProgressionNetworkControllerOptions['resolveTrainerId'];

  constructor(options: PokemonProgressionNetworkControllerOptions) {
    this.progressionManager = options.progressionManager;
    this.trainerStatePresenter = options.trainerStatePresenter;
    this.resolveTrainerId = options.resolveTrainerId;
  }

  public async handleMoveLearningDecision(
    client: Socket,
    payload: unknown,
  ): Promise<void> {
    if (!isPokemonMoveLearningDecisionInput(payload)) {
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
      const result = await this.progressionManager.resolveMoveLearningDecision({
        trainerId,
        pokemonInstanceId: payload.pokemonInstanceId,
        decision: payload.decision,
        expectedRevision: payload.revision,
      });

      const evolutionPayload: PokemonEvolutionResolvedPayload | null =
        result.evolution
          ? {
              pokemonInstanceId: result.evolution.pokemonInstanceId,
              previousSpeciesId: result.evolution.sourceSpeciesId,
              previousFormId: result.evolution.sourceFormId,
              currentSpeciesId: result.evolution.targetSpeciesId,
              currentFormId: result.evolution.targetFormId,
            }
          : null;

      const updatedPokemon = result.trainerState.party.pokemon.find(
        (pokemon) => pokemon.instanceId === payload.pokemonInstanceId,
      );

      if (!updatedPokemon) {
        throw new Error(
          `Updated Pokémon "${payload.pokemonInstanceId}" missing after move-learning decision`,
        );
      }

      let nextPending: PokemonMoveLearningResolvedPayload['nextPending'] = null;

      if (
        result.hasNextPendingDecision &&
        result.continuation.status === 'pending-decision'
      ) {
        const candidate = toPendingMoveLearningCandidate(
          result.continuation.pendingDecision.candidate,
        );

        nextPending = {
          pokemonInstanceId: payload.pokemonInstanceId,
          candidateMoveId: candidate.moveId,
          candidateLearnedAtLevel: candidate.learnedAtLevel,
          revision: payload.revision + 1,
          currentMoves: updatedPokemon.moves,
        };
      }

      this.trainerStatePresenter.emitTrainerState(client, result.trainerState);

      if (evolutionPayload) {
        client.emit(POKEMON_EVENTS.EVOLUTION_RESOLVED, evolutionPayload);
      }

      client.emit(POKEMON_EVENTS.MOVE_LEARNING_RESOLVED, {
        pokemonInstanceId: payload.pokemonInstanceId,
        resolvedCandidateMoveId: payload.candidateMoveId,
        resolvedRevision: payload.revision,
        decision: payload.decision,
        currentMoves: updatedPokemon.moves,
        nextPending,
      } satisfies PokemonMoveLearningResolvedPayload);
    } catch (error: unknown) {
      const code =
        error instanceof PokemonProgressionError
          ? error.code
          : 'MOVE_LEARNING_FAILED';

      const message =
        error instanceof Error
          ? error.message
          : 'Failed to resolve Pokémon move learning.';

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
    client.emit(POKEMON_EVENTS.MOVE_LEARNING_ERROR, {
      pokemonInstanceId,
      revision,
      code,
      message,
    } satisfies PokemonMoveLearningErrorPayload);
  }
}
