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
}
