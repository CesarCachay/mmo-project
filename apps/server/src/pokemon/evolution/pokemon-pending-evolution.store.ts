import { Injectable } from '@nestjs/common';

import type { PokemonPendingEvolutionState } from './pokemon-pending-evolution.types';

@Injectable()
export class PokemonPendingEvolutionStore {
  private readonly byPokemonInstanceId = new Map<
    string,
    PokemonPendingEvolutionState
  >();

  public getByPokemonInstanceId(
    pokemonInstanceId: string,
  ): PokemonPendingEvolutionState | undefined {
    return this.byPokemonInstanceId.get(pokemonInstanceId);
  }

  public set(pending: PokemonPendingEvolutionState): void {
    this.byPokemonInstanceId.set(pending.pokemonInstanceId, pending);
  }

  public remove(pokemonInstanceId: string): void {
    this.byPokemonInstanceId.delete(pokemonInstanceId);
  }

  public clear(): void {
    this.byPokemonInstanceId.clear();
  }

  public getByTrainerId(
    trainerId: string,
  ): readonly PokemonPendingEvolutionState[] {
    return [...this.byPokemonInstanceId.values()].filter(
      (pending) => pending.trainerId === trainerId,
    );
  }

  public replaceForTrainer(
    trainerId: string,
    pendings: readonly PokemonPendingEvolutionState[],
  ): void {
    /*
     * PostgreSQL is durable authority.
     *
     * Remove any stale RAM state for this
     * Trainer before hydrating the DB snapshot.
     */
    for (const [
      pokemonInstanceId,
      pending,
    ] of this.byPokemonInstanceId.entries()) {
      if (pending.trainerId === trainerId) {
        this.byPokemonInstanceId.delete(pokemonInstanceId);
      }
    }

    for (const pending of pendings) {
      if (pending.trainerId !== trainerId) {
        throw new Error(
          [
            'Cannot restore pending Evolution',
            `for trainer "${trainerId}":`,
            `received state owned by "${pending.trainerId}"`,
          ].join(' '),
        );
      }

      this.set(pending);
    }
  }
}
