import { Injectable } from '@nestjs/common';

import type { PokemonTrainerId } from '../pokemon-trainer-identity';

import { PokemonPendingEvolutionRepository } from './pokemon-pending-evolution.repository';

import { PokemonPendingEvolutionStore } from './pokemon-pending-evolution.store';

import type { PokemonPendingEvolutionState } from './pokemon-pending-evolution.types';

export interface RestorePendingEvolutionInput {
  readonly trainerId: PokemonTrainerId;
  readonly partyPokemonInstanceIds: readonly string[];
}

@Injectable()
export class PokemonPendingEvolutionRecoveryService {
  constructor(
    private readonly repository: PokemonPendingEvolutionRepository,
    private readonly store: PokemonPendingEvolutionStore,
  ) {}

  public async restoreTrainerPendings(
    input: RestorePendingEvolutionInput,
  ): Promise<readonly PokemonPendingEvolutionState[]> {
    const persisted = await this.repository.findAllByTrainerId(input.trainerId);

    const partyOrder = new Map<string, number>(
      input.partyPokemonInstanceIds.map((pokemonInstanceId, index) => [
        pokemonInstanceId,
        index,
      ]),
    );

    /* Evolution V1 only supports Pokémon belonging to the active Party */
    const restorable = persisted.filter((pending) =>
      partyOrder.has(pending.pokemonInstanceId),
    );

    const orphaned = persisted.filter(
      (pending) => !partyOrder.has(pending.pokemonInstanceId),
    );

    if (orphaned.length > 0) {
      console.warn(
        '[PokemonEvolutionRecovery] pending Evolutions outside active Party',
        {
          trainerId: input.trainerId,
          pokemonInstanceIds: orphaned.map(
            (pending) => pending.pokemonInstanceId,
          ),
        },
      );
    }

    /* Restore in Party order rather than arbitrary DB order */
    const ordered = [...restorable].sort((left, right) => {
      const leftIndex = partyOrder.get(left.pokemonInstanceId);
      const rightIndex = partyOrder.get(right.pokemonInstanceId);

      return (
        (leftIndex ?? Number.MAX_SAFE_INTEGER) -
        (rightIndex ?? Number.MAX_SAFE_INTEGER)
      );
    });

    /* PostgreSQL snapshot replaces RAM state for this Trainer */
    this.store.replaceForTrainer(input.trainerId, ordered);

    return ordered;
  }
}
