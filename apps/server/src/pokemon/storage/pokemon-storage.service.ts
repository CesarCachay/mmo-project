import type { PokemonStorage, PokemonTrainerState } from '@cesar-mmo/shared';
import type { PokemonTrainerId } from '../pokemon-trainer-identity';
import { PokemonTrainerStateStore } from '../pokemon-trainer-state.store.js';
import { PokemonPartyRepository } from '../pokemon-party.repository';

import {
  PokemonStoragePersistenceError,
  PokemonStorageRepository,
} from './pokemon-storage.repository';

export interface PokemonStorageServiceState {
  readonly trainerState: PokemonTrainerState;
  readonly storage: PokemonStorage;
}

export class PokemonStorageService {
  /*
   * V1 server-local lock.
   * Evita dos mutaciones simultáneas del mismo Trainer dentro de esta instancia del servidor.
   */
  private readonly mutationLocks = new Set<PokemonTrainerId>();

  constructor(
    private readonly trainerStateStore: PokemonTrainerStateStore,
    private readonly pokemonPartyRepository: PokemonPartyRepository,
    private readonly pokemonStorageRepository: PokemonStorageRepository,
  ) {}

  async getState(
    trainerId: PokemonTrainerId,
  ): Promise<PokemonStorageServiceState> {
    this.requireTrainerState(trainerId);

    /*
     * Party y Storage se leen desde la fuente durable.
     * Al abrir PC no dependemos de una colección Storage
     * almacenada en RAM.
     */
    const [party, storage] = await Promise.all([
      this.pokemonPartyRepository.loadParty(trainerId),
      this.pokemonStorageRepository.loadStorage(trainerId),
    ]);

    /* Reconciliamos RAM con la Party persistida. No existe Storage RAM */
    const trainerState = this.trainerStateStore.setParty(trainerId, party);

    return {
      trainerState,
      storage,
    };
  }

  async withdraw(
    trainerId: PokemonTrainerId,
    pokemonInstanceId: string,
  ): Promise<PokemonStorageServiceState> {
    return this.executeMutation(trainerId, async () => {
      await this.pokemonStorageRepository.withdraw(
        trainerId,
        pokemonInstanceId,
      );
    });
  }

  async deposit(
    trainerId: PokemonTrainerId,
    pokemonInstanceId: string,
  ): Promise<PokemonStorageServiceState> {
    return this.executeMutation(trainerId, async () => {
      await this.pokemonStorageRepository.deposit(trainerId, pokemonInstanceId);
    });
  }

  async swap(
    trainerId: PokemonTrainerId,
    storedPokemonInstanceId: string,
    partyPokemonInstanceId: string,
  ): Promise<PokemonStorageServiceState> {
    return this.executeMutation(trainerId, async () => {
      await this.pokemonStorageRepository.swap(
        trainerId,
        storedPokemonInstanceId,
        partyPokemonInstanceId,
      );
    });
  }

  private requireTrainerState(
    trainerId: PokemonTrainerId,
  ): PokemonTrainerState {
    const trainerState = this.trainerStateStore.get(trainerId);

    if (!trainerState) {
      throw new Error(
        `Pokémon Trainer state not found for trainer "${trainerId}"`,
      );
    }

    return trainerState;
  }

  private async executeMutation(
    trainerId: PokemonTrainerId,
    mutation: () => Promise<void>,
  ): Promise<PokemonStorageServiceState> {
    this.requireTrainerState(trainerId);

    /* Double-submit mientras una operación anterior sigue pendiente */
    if (this.mutationLocks.has(trainerId)) {
      throw new PokemonStoragePersistenceError(
        'STALE_COMMAND',
        `A Storage mutation is already in progress for trainer "${trainerId}"`,
      );
    }

    this.mutationLocks.add(trainerId);

    try {
      /* POSTGRESQL FIRST. Nada cambia todavía en TrainerStateStore */
      await mutation();

      /* COMMIT ya ocurrió. Ahora reconstruimos snapshots autoritativos desde DB */
      const [party, storage] = await Promise.all([
        this.pokemonPartyRepository.loadParty(trainerId),
        this.pokemonStorageRepository.loadStorage(trainerId),
      ]);

      /* RAM SECOND */
      const trainerState = this.trainerStateStore.setParty(trainerId, party);

      return {
        trainerState,
        storage,
      };
    } finally {
      this.mutationLocks.delete(trainerId);
    }
  }
}
