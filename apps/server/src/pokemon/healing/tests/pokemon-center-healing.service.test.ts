import {
  calculatePokemonMaxHp,
  createPokemonInventory,
  getPokemonMove,
} from '@cesar-mmo/shared';

import type { PokemonParty, PokemonTrainerState } from '@cesar-mmo/shared';

import { describe, expect, it, vi } from 'vitest';

import type { PokemonTrainerId } from '../../pokemon-trainer-identity';

import type { PokemonTrainerStateStore } from '../../pokemon-trainer-state.store';

import { PokemonCenterHealingPersistenceConflictError } from '../pokemon-center-healing.repository';

import type { PokemonCenterHealingRepository } from '../pokemon-center-healing.repository';

import { PokemonCenterHealingOperationQueue } from '../pokemon-center-healing-operation.queue';

import {
  PokemonCenterHealingError,
  PokemonCenterHealingService,
} from '../pokemon-center-healing.service';

const trainerId = 'trainer-healing-test' as PokemonTrainerId;

function createDamagedParty(): PokemonParty {
  return {
    pokemon: [
      {
        instanceId: 'pokemon-charmander',
        speciesId: 4,
        formId: 4,
        level: 12,
        experience: 1728,
        currentHp: 7,
        abilityId: 66,
        moves: [
          {
            moveId: 10,
            currentPp: 4,
          },
          {
            moveId: 52,
            currentPp: 2,
          },
        ],
      },
    ],
  };
}

function createHealthyParty(): PokemonParty {
  const damagedParty = createDamagedParty();

  const pokemon = damagedParty.pokemon[0];

  const scratch = getPokemonMove(10);

  const ember = getPokemonMove(52);

  if (!scratch || !ember) {
    throw new Error('Required test moves were not found');
  }

  return {
    pokemon: [
      {
        ...pokemon,
        currentHp: calculatePokemonMaxHp(pokemon),
        moves: [
          {
            moveId: 10,
            currentPp: scratch.pp ?? 0,
          },
          {
            moveId: 52,
            currentPp: ember.pp ?? 0,
          },
        ],
      },
    ],
  };
}

function createTrainerState(
  party: PokemonParty = createDamagedParty(),
): PokemonTrainerState {
  return {
    party,

    inventory: createPokemonInventory(),
    money: 3_000,
  };
}

function createServiceHarness(...args: [] | [PokemonTrainerState | undefined]) {
  let runtimeTrainerState = args.length === 0 ? createTrainerState() : args[0];

  const operationOrder: string[] = [];

  const get = vi.fn(() => runtimeTrainerState);

  const setParty = vi.fn(
    (
      _trainerId: PokemonTrainerId,
      party: PokemonParty,
    ): PokemonTrainerState => {
      operationOrder.push('ram');

      if (!runtimeTrainerState) {
        throw new Error('Trainer state missing in test harness');
      }

      runtimeTrainerState = {
        ...runtimeTrainerState,
        party,
      };

      return runtimeTrainerState;
    },
  );

  const trainerStateStore = {
    get,
    setParty,
  } as unknown as PokemonTrainerStateStore;

  const applyHealing = vi.fn(async (): Promise<void> => {
    operationOrder.push('db');
  });

  const repository = {
    applyHealing,
  } as unknown as PokemonCenterHealingRepository;

  const operationQueue = new PokemonCenterHealingOperationQueue();

  const service = new PokemonCenterHealingService(
    trainerStateStore,
    repository,
    operationQueue,
  );

  return {
    service,
    trainerStateStore,
    repository,
    get,
    setParty,
    applyHealing,
    operationOrder,
    getRuntimeTrainerState: () => runtimeTrainerState,
  };
}

describe('PokemonCenterHealingService', () => {
  it('persists healing before updating runtime TrainerState', async () => {
    const harness = createServiceHarness();

    const originalState = harness.getRuntimeTrainerState();

    if (!originalState) {
      throw new Error('Expected Trainer state');
    }

    const result = await harness.service.healParty(trainerId);

    expect(harness.applyHealing).toHaveBeenCalledTimes(1);

    expect(harness.setParty).toHaveBeenCalledTimes(1);

    expect(harness.operationOrder).toEqual(['db', 'ram']);

    expect(result.restoredPokemonCount).toBe(1);

    expect(result.totalHpRestored).toBeGreaterThan(0);

    expect(result.totalPpRestored).toBeGreaterThan(0);

    const healedPokemon = result.trainerState.party.pokemon[0];

    expect(healedPokemon.currentHp).toBe(calculatePokemonMaxHp(healedPokemon));

    expect(originalState.party.pokemon[0].currentHp).toBe(7);
  });

  it('fails before persistence when TrainerState does not exist', async () => {
    const harness = createServiceHarness(undefined);

    await expect(harness.service.healParty(trainerId)).rejects.toMatchObject({
      code: 'TRAINER_STATE_NOT_FOUND',
    } satisfies Partial<PokemonCenterHealingError>);

    expect(harness.applyHealing).not.toHaveBeenCalled();

    expect(harness.setParty).not.toHaveBeenCalled();
  });

  it('does not write PostgreSQL or RAM when the Party is already fully healed', async () => {
    const trainerState = createTrainerState(createHealthyParty());

    const harness = createServiceHarness(trainerState);

    const result = await harness.service.healParty(trainerId);

    expect(harness.applyHealing).not.toHaveBeenCalled();

    expect(harness.setParty).not.toHaveBeenCalled();

    expect(result.trainerState).toBe(trainerState);

    expect(result.restoredPokemonCount).toBe(0);

    expect(result.totalHpRestored).toBe(0);

    expect(result.totalPpRestored).toBe(0);
  });

  it('does not mutate RAM when PostgreSQL reports a persistence conflict', async () => {
    const harness = createServiceHarness();

    harness.applyHealing.mockRejectedValueOnce(
      new PokemonCenterHealingPersistenceConflictError(
        'POKEMON_STATE_CHANGED',
        'Pokémon state changed',
      ),
    );

    await expect(harness.service.healParty(trainerId)).rejects.toMatchObject({
      code: 'PERSISTENCE_CONFLICT',
    } satisfies Partial<PokemonCenterHealingError>);

    expect(harness.setParty).not.toHaveBeenCalled();

    expect(harness.getRuntimeTrainerState()?.party.pokemon[0]?.currentHp).toBe(
      7,
    );
  });

  it('does not mutate RAM when persistence fails unexpectedly', async () => {
    const harness = createServiceHarness();

    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    harness.applyHealing.mockRejectedValueOnce(
      new Error('database unavailable'),
    );

    try {
      await expect(harness.service.healParty(trainerId)).rejects.toMatchObject({
        code: 'PERSISTENCE_FAILED',
      } satisfies Partial<PokemonCenterHealingError>);

      expect(harness.setParty).not.toHaveBeenCalled();

      expect(
        harness.getRuntimeTrainerState()?.party.pokemon[0]?.currentHp,
      ).toBe(7);
    } finally {
      consoleError.mockRestore();
    }
  });

  it('serializes concurrent healing requests for the same Trainer', async () => {
    const harness = createServiceHarness();

    let releasePersistence: (() => void) | undefined;

    const pendingPersistence = new Promise<void>((resolve) => {
      releasePersistence = resolve;
    });

    harness.applyHealing.mockReset().mockImplementationOnce(async () => {
      harness.operationOrder.push('db');

      await pendingPersistence;
    });

    const first = harness.service.healParty(trainerId);

    const second = harness.service.healParty(trainerId);

    /*
     * Permitimos que la primera operación llegue
     * al repository.
     */
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });

    /*
     * La segunda solicitud todavía debe estar
     * esperando en la queue.
     */
    expect(harness.applyHealing).toHaveBeenCalledTimes(1);

    expect(harness.setParty).not.toHaveBeenCalled();

    if (!releasePersistence) {
      throw new Error('Persistence release callback was not created');
    }

    releasePersistence();

    const [firstResult, secondResult] = await Promise.all([first, second]);

    /*
     * La segunda ejecución observa el Party ya
     * curado en RAM y se convierte en no-op.
     *
     * Por eso PostgreSQL sólo recibió una
     * operación real de healing.
     */
    expect(harness.applyHealing).toHaveBeenCalledTimes(1);

    expect(harness.setParty).toHaveBeenCalledTimes(1);

    expect(firstResult.restoredPokemonCount).toBe(1);

    expect(secondResult.restoredPokemonCount).toBe(0);
  });
});
