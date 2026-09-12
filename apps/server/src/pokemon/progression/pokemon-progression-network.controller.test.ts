import { describe, expect, it, vi } from 'vitest';

import type { Socket } from 'socket.io';

import {
  POKEMON_EVENTS,
  isPokemonMoveLearningResolvedPayload,
} from '@cesar-mmo/shared';

import type {
  PokemonMoveLearningDecisionInput,
  PokemonTrainerState,
} from '@cesar-mmo/shared';

import type { PokemonTrainerId } from '../pokemon-trainer-identity';

import type { PokemonTrainerStateNetworkPresenter } from '../network/PokemonTrainerStateNetworkPresenter';

import type { PokemonProgressionManager } from './pokemon-progression.manager';

import { PokemonProgressionNetworkController } from './pokemon-progression-network.controller';

const trainerId = 'trainer-test' as PokemonTrainerId;

const pokemonInstanceId = 'pokemon-instance-a';

const currentMoves = [
  {
    moveId: 1,
    currentPp: 35,
  },
  {
    moveId: 2,
    currentPp: 25,
  },
  {
    moveId: 3,
    currentPp: 20,
  },
  {
    moveId: 4,
    currentPp: 15,
  },
] as const;

const trainerState = {
  party: {
    pokemon: [
      {
        instanceId: pokemonInstanceId,

        speciesId: 4,
        formId: 4,

        level: 16,
        experience: 2500,

        currentHp: 40,

        abilityId: 1,

        moves: currentMoves,
      },
    ],
  },
} as unknown as PokemonTrainerState;

const decisionPayload: PokemonMoveLearningDecisionInput = {
  pokemonInstanceId,

  candidateMoveId: 52,

  revision: 0,

  decision: {
    type: 'cancel',
  },
};

interface TestHarnessOptions {
  readonly pendingEvolution: {
    readonly trainerId: PokemonTrainerId;

    readonly pokemonInstanceId: string;

    readonly sourceSpeciesId: number;

    readonly sourceFormId: number;

    readonly targetSpeciesId: number;

    readonly targetFormId: number;

    readonly triggerLevel: number;

    readonly revision: number;
  } | null;
}

function createHarness(options: TestHarnessOptions) {
  const resolveMoveLearningDecision = vi.fn().mockResolvedValue({
    trainerState,

    decision: decisionPayload.decision,

    /*
     * The controller only needs the
     * status unless another Move Learning
     * decision exists.
     */
    continuation: {
      status: 'complete',
    },

    hasNextPendingDecision: false,

    pendingEvolution: options.pendingEvolution,
  });

  const progressionManager = {
    resolveMoveLearningDecision,
  } as unknown as PokemonProgressionManager;

  const emitTrainerState = vi.fn();

  const trainerStatePresenter = {
    emitTrainerState,
  } as unknown as PokemonTrainerStateNetworkPresenter;

  const emit = vi.fn((eventName: string, payload: unknown): boolean => {
    void eventName;
    void payload;

    return true;
  });

  const client = {
    id: 'socket-test',
    emit,
  } as unknown as Socket;

  const controller = new PokemonProgressionNetworkController({
    progressionManager,

    trainerStatePresenter,

    resolveTrainerId: () => trainerId,
  });

  return {
    controller,
    client,
    emit,
    emitTrainerState,
    resolveMoveLearningDecision,
  };
}

describe('PokemonProgressionNetworkController', () => {
  it('embeds pending Evolution inside MOVE_LEARNING_RESOLVED', async () => {
    const harness = createHarness({
      pendingEvolution: {
        trainerId,

        pokemonInstanceId,

        sourceSpeciesId: 4,
        sourceFormId: 4,

        targetSpeciesId: 5,
        targetFormId: 5,

        triggerLevel: 16,

        revision: 0,
      },
    });

    await harness.controller.handleMoveLearningDecision(
      harness.client,
      decisionPayload,
    );

    expect(harness.resolveMoveLearningDecision).toHaveBeenCalledTimes(1);

    expect(harness.emitTrainerState).toHaveBeenCalledTimes(1);

    const resolvedCall = harness.emit.mock.calls.find(
      ([eventName]) => eventName === POKEMON_EVENTS.MOVE_LEARNING_RESOLVED,
    );

    expect(resolvedCall).toBeDefined();

    if (!resolvedCall) {
      throw new Error('MOVE_LEARNING_RESOLVED was not emitted');
    }

    const resolvedPayload = resolvedCall[1];

    /*
     * Validate the actual network
     * payload through the shared
     * production validator.
     */
    expect(isPokemonMoveLearningResolvedPayload(resolvedPayload)).toBe(true);

    expect(resolvedPayload).toMatchObject({
      pokemonInstanceId,

      resolvedCandidateMoveId: decisionPayload.candidateMoveId,

      resolvedRevision: 0,

      nextPending: null,

      pendingEvolution: {
        pokemonInstanceId,

        sourceSpeciesId: 4,
        sourceFormId: 4,

        targetSpeciesId: 5,
        targetFormId: 5,

        triggerLevel: 16,

        revision: 0,
      },
    });
  });

  it('does not emit standalone EVOLUTION_REQUIRED after Move Learning', async () => {
    const harness = createHarness({
      pendingEvolution: {
        trainerId,

        pokemonInstanceId,

        sourceSpeciesId: 4,
        sourceFormId: 4,

        targetSpeciesId: 5,
        targetFormId: 5,

        triggerLevel: 16,

        revision: 0,
      },
    });

    await harness.controller.handleMoveLearningDecision(
      harness.client,
      decisionPayload,
    );

    const standaloneEvolution = harness.emit.mock.calls.some(
      ([eventName]) => eventName === POKEMON_EVENTS.EVOLUTION_REQUIRED,
    );

    expect(standaloneEvolution).toBe(false);
  });

  it('returns pendingEvolution null when no Evolution is required', async () => {
    const harness = createHarness({
      pendingEvolution: null,
    });

    await harness.controller.handleMoveLearningDecision(
      harness.client,
      decisionPayload,
    );

    const resolvedCall = harness.emit.mock.calls.find(
      ([eventName]) => eventName === POKEMON_EVENTS.MOVE_LEARNING_RESOLVED,
    );

    expect(resolvedCall).toBeDefined();

    if (!resolvedCall) {
      throw new Error('MOVE_LEARNING_RESOLVED was not emitted');
    }

    expect(resolvedCall[1]).toMatchObject({
      pokemonInstanceId,

      nextPending: null,

      pendingEvolution: null,
    });

    expect(isPokemonMoveLearningResolvedPayload(resolvedCall[1])).toBe(true);
  });
});
