import { describe, expect, it, vi } from 'vitest';

import type { PokemonTrainerId } from '../pokemon-trainer-identity';

import type { PokemonPendingEvolutionRepository } from './pokemon-pending-evolution.repository';

import { PokemonPendingEvolutionRecoveryService } from './pokemon-pending-evolution-recovery.service';

import { PokemonPendingEvolutionStore } from './pokemon-pending-evolution.store';

import type { PokemonPendingEvolutionState } from './pokemon-pending-evolution.types';

const trainerId = 'trainer-a' as PokemonTrainerId;

const otherTrainerId = 'trainer-b' as PokemonTrainerId;

function pending(
  trainer: PokemonTrainerId,

  pokemonInstanceId: string,

  sourceSpeciesId: number,

  targetSpeciesId: number,
): PokemonPendingEvolutionState {
  return {
    trainerId: trainer,

    pokemonInstanceId,

    sourceSpeciesId,
    sourceFormId: sourceSpeciesId,

    targetSpeciesId,
    targetFormId: targetSpeciesId,

    triggerLevel: 16,

    revision: 0,
  };
}

describe('PokemonPendingEvolutionRecoveryService', () => {
  it('restores every Party pending Evolution in authoritative Party order', async () => {
    const pokemonA = pending(trainerId, 'pokemon-a', 1, 2);

    const pokemonB = pending(trainerId, 'pokemon-b', 4, 5);

    const orphan = pending(trainerId, 'pokemon-orphan', 7, 8);

    const findAllByTrainerId = vi.fn(() =>
      Promise.resolve([pokemonB, orphan, pokemonA]),
    );

    const repository = {
      findAllByTrainerId,
    } as unknown as PokemonPendingEvolutionRepository;

    const store = new PokemonPendingEvolutionStore();

    /*
     * Existing stale RAM state for
     * trainer A must disappear.
     */
    store.set(pending(trainerId, 'stale-pokemon', 10, 11));

    /*
     * Another Trainer must not be touched.
     */
    const otherTrainerPending = pending(
      otherTrainerId,
      'other-trainer-pokemon',
      13,
      14,
    );

    store.set(otherTrainerPending);

    const service = new PokemonPendingEvolutionRecoveryService(
      repository,
      store,
    );

    const result = await service.restoreTrainerPendings({
      trainerId,

      /*
       * Party order says:
       *
       * A first
       * B second
       */
      partyPokemonInstanceIds: ['pokemon-a', 'pokemon-b'],
    });

    expect(result.map((entry) => entry.pokemonInstanceId)).toEqual([
      'pokemon-a',
      'pokemon-b',
    ]);

    expect(findAllByTrainerId).toHaveBeenCalledWith(trainerId);

    /*
     * Trainer A cache is fully replaced.
     */
    expect(store.getByPokemonInstanceId('stale-pokemon')).toBeUndefined();

    expect(store.getByPokemonInstanceId('pokemon-a')).toBe(pokemonA);

    expect(store.getByPokemonInstanceId('pokemon-b')).toBe(pokemonB);

    /*
     * Orphan is deliberately NOT hydrated.
     */
    expect(store.getByPokemonInstanceId('pokemon-orphan')).toBeUndefined();

    /*
     * Trainer B is untouched.
     */
    expect(store.getByPokemonInstanceId('other-trainer-pokemon')).toBe(
      otherTrainerPending,
    );
  });

  it('clears stale Trainer RAM state when PostgreSQL has no pending Evolutions', async () => {
    const findAllByTrainerId = vi.fn(() =>
      Promise.resolve([] as PokemonPendingEvolutionState[]),
    );
    const repository = {
      findAllByTrainerId,
    } as unknown as PokemonPendingEvolutionRepository;

    const store = new PokemonPendingEvolutionStore();

    store.set(pending(trainerId, 'stale-pokemon', 1, 2));

    const service = new PokemonPendingEvolutionRecoveryService(
      repository,
      store,
    );

    const result = await service.restoreTrainerPendings({
      trainerId,

      partyPokemonInstanceIds: ['stale-pokemon'],
    });

    expect(result).toEqual([]);

    expect(store.getByPokemonInstanceId('stale-pokemon')).toBeUndefined();
  });
});
