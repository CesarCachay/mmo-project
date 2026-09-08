import type {
  PokemonTrainerState,
  BattleParticipant,
  PokemonStarterId,
  PokemonItemId,
  PokemonParty,
  PokemonPartyReorderErrorCode,
} from '@cesar-mmo/shared';
import {
  addPokemonToParty,
  createPokemonInstance,
  POKEMON_STARTERS,
  syncPokemonPartyFromBattleParticipant,
  addPokemonInventoryItem,
  consumePokemonInventoryItem,
  // getPokemonInventoryItemQuantity,
} from '@cesar-mmo/shared';

import type { PokemonTrainerId } from './pokemon-trainer-identity';

import { PokemonTrainerStateStore } from './pokemon-trainer-state.store.js';

import { PokemonPartyRepository } from './pokemon-party.repository';
import { PokemonInventoryRepository } from './inventory/pokemon-inventory.repository';

export class PokemonPartyReorderError extends Error {
  constructor(
    public readonly code: PokemonPartyReorderErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PokemonPartyReorderError';
  }
}

export class PokemonTrainerService {
  private readonly partyReorderQueues = new Map<
    PokemonTrainerId,
    Promise<unknown>
  >();

  constructor(
    private readonly trainerStateStore: PokemonTrainerStateStore,
    private readonly pokemonPartyRepository: PokemonPartyRepository,
    private readonly pokemonInventoryRepository: PokemonInventoryRepository,
  ) {
    this.trainerStateStore = trainerStateStore;
  }

  public async addPokemon(
    trainerId: PokemonTrainerId,
    speciesId: number,
    level: number,
  ): Promise<PokemonTrainerState> {
    const trainerState = this.trainerStateStore.get(trainerId);

    if (!trainerState) {
      throw new Error(
        `Pokémon trainer state not found for trainer ${trainerId}`,
      );
    }

    const pokemon = createPokemonInstance(speciesId, level);
    const updatedParty = addPokemonToParty(trainerState.party, pokemon);

    /* Persistimos primero. Si PostgreSQL falla, NO modificamos el estado runtime. */
    await this.pokemonPartyRepository.saveParty(trainerId, updatedParty);
    return this.trainerStateStore.setParty(trainerId, updatedParty);
  }

  public reorderParty(
    trainerId: PokemonTrainerId,
    pokemonInstanceId: string,
    targetPosition: number,
  ): Promise<PokemonTrainerState> {
    return this.enqueuePartyReorder(trainerId, () =>
      this.reorderPartyInternal(trainerId, pokemonInstanceId, targetPosition),
    );
  }

  public async chooseStarter(
    trainerId: PokemonTrainerId,
    starterId: PokemonStarterId,
  ): Promise<PokemonTrainerState> {
    const trainerState = this.trainerStateStore.get(trainerId);

    if (!trainerState) {
      throw new Error(
        `Pokémon trainer state not found for trainer ${trainerId}`,
      );
    }

    if (trainerState.party.pokemon.length > 0) {
      throw new Error(
        `Trainer ${trainerId} already has a Pokémon and cannot choose a starter`,
      );
    }

    if (!this.trainerStateStore.isStarterSelectionUnlocked(trainerId)) {
      throw new Error(
        `Starter selection is not unlocked for trainer ${trainerId}`,
      );
    }

    const starter = POKEMON_STARTERS[starterId];

    /* Bloqueamos ANTES del await para evitar dos elecciones concurrentes. */
    this.trainerStateStore.lockStarterSelection(trainerId);

    try {
      return await this.addPokemon(trainerId, starter.speciesId, starter.level);
    } catch (error: unknown) {
      /* Si falla PostgreSQL permitimos que el jugador reintente. */
      this.trainerStateStore.unlockStarterSelection(trainerId);
      throw error;
    }
  }

  public async syncBattleParticipantResult(
    trainerId: PokemonTrainerId,
    trainerParticipant: BattleParticipant,
  ): Promise<PokemonTrainerState> {
    const trainerState = this.trainerStateStore.get(trainerId);

    if (!trainerState) {
      throw new Error(
        `Pokémon Trainer state not found for Trainer "${trainerId}" while synchronizing Battle result`,
      );
    }

    const updatedParty = syncPokemonPartyFromBattleParticipant(
      trainerState.party,
      trainerParticipant,
    );

    // Persist FIRST.
    // If PostgreSQL fails, RAM remains unchanged.
    await this.pokemonPartyRepository.saveParty(trainerId, updatedParty);

    // Only after durable persistence succeeds do we update runtime Trainer state.
    return this.trainerStateStore.setParty(trainerId, updatedParty);
  }

  // TO REMOVE - TEST
  // public async ensureDevelopmentBattleTestParty(
  //   trainerId: PokemonTrainerId,
  // ): Promise<PokemonTrainerState> {
  //   const trainerState = this.trainerStateStore.get(trainerId);

  //   if (!trainerState) {
  //     throw new Error(
  //       `Pokémon trainer state not found for trainer ${trainerId}`,
  //     );
  //   }

  //   /* Importante: este seed JAMÁS debe ejecutarse accidentalmente en producción. */
  //   if (process.env.NODE_ENV === 'production') {
  //     return trainerState;
  //   }
  //   const hasLatios = trainerState.party.pokemon.some(
  //     (pokemon) => pokemon.speciesId === 381,
  //   );
  //   const hasLarvitar = trainerState.party.pokemon.some(
  //     (pokemon) => pokemon.speciesId === 246,
  //   );
  //   let updatedState = trainerState;

  //   if (!hasLatios) {
  //     updatedState = await this.addPokemon(trainerId, 381, 15);
  //   }
  //   if (!hasLarvitar) {
  //     updatedState = await this.addPokemon(trainerId, 246, 7);
  //   }
  //   const pokeBallQuantity = getPokemonInventoryItemQuantity(
  //     updatedState.inventory,
  //     'poke-ball',
  //   );
  //   if (pokeBallQuantity <= 0) {
  //     updatedState = await this.addInventoryItem(trainerId, 'poke-ball', 50);
  //   }
  //   const potionQuantity = getPokemonInventoryItemQuantity(
  //     updatedState.inventory,
  //     'potion',
  //   );
  //   if (potionQuantity <= 0) {
  //     updatedState = await this.addInventoryItem(trainerId, 'potion', 30);
  //   }
  //   return updatedState;
  // }

  public async addInventoryItem(
    trainerId: PokemonTrainerId,
    itemId: PokemonItemId,
    quantity: number = 1,
  ): Promise<PokemonTrainerState> {
    const trainerState = this.trainerStateStore.get(trainerId);

    if (!trainerState) {
      throw new Error(
        `Pokémon trainer state not found for trainer ${trainerId}`,
      );
    }

    const updatedInventory = addPokemonInventoryItem(
      trainerState.inventory,
      itemId,
      quantity,
    );

    await this.pokemonInventoryRepository.saveInventory(
      trainerId,
      updatedInventory,
    );

    return this.trainerStateStore.setInventory(trainerId, updatedInventory);
  }

  public async consumeInventoryItem(
    trainerId: PokemonTrainerId,
    itemId: PokemonItemId,
    quantity: number = 1,
  ): Promise<PokemonTrainerState> {
    const trainerState = this.trainerStateStore.get(trainerId);

    if (!trainerState) {
      throw new Error(
        `Pokémon trainer state not found for trainer ${trainerId}`,
      );
    }

    const updatedInventory = consumePokemonInventoryItem(
      trainerState.inventory,
      itemId,
      quantity,
    );

    await this.pokemonInventoryRepository.saveInventory(
      trainerId,
      updatedInventory,
    );

    return this.trainerStateStore.setInventory(trainerId, updatedInventory);
  }

  private async reorderPartyInternal(
    trainerId: PokemonTrainerId,
    pokemonInstanceId: string,
    targetPosition: number,
  ): Promise<PokemonTrainerState> {
    /* RAM es el runtime authoritative snapshot desde el que calculamos la intención */
    const trainerState = this.trainerStateStore.get(trainerId);

    if (!trainerState) {
      throw new PokemonPartyReorderError(
        'INCOMPATIBLE_STATE',
        `Pokémon trainer state not found for trainer ${trainerId}`,
      );
    }

    const party = trainerState.party;

    const sourcePosition = party.pokemon.findIndex(
      (pokemon) => pokemon.instanceId === pokemonInstanceId,
    );

    if (sourcePosition < 0) {
      throw new PokemonPartyReorderError(
        'POKEMON_NOT_IN_PARTY',
        `Pokémon ${pokemonInstanceId} is not in trainer ${trainerId} active party`,
      );
    }

    /*
     * El network validator ya limita 0..5,
     * pero el servidor también debe validar
     * contra el tamaño REAL del Party.
     */
    if (
      !Number.isInteger(targetPosition) ||
      targetPosition < 0 ||
      targetPosition >= party.pokemon.length
    ) {
      throw new PokemonPartyReorderError(
        'INVALID_POSITION',
        `Party position ${targetPosition} is invalid for party size ${party.pokemon.length}`,
      );
    }

    if (sourcePosition === targetPosition) {
      return trainerState;
    }

    const updatedParty = this.swapPokemonInParty(
      party,
      sourcePosition,
      targetPosition,
    );

    /* DB FIRST. savePartyOrder() modifica únicamente partyPosition */
    await this.pokemonPartyRepository.savePartyOrder(
      trainerId,
      updatedParty.pokemon.map((pokemon) => pokemon.instanceId),
    );

    /* RAM SECOND. Sólo después del commit exitoso */
    return this.trainerStateStore.setParty(trainerId, updatedParty);
  }

  private swapPokemonInParty(
    party: PokemonParty,
    sourcePosition: number,
    targetPosition: number,
  ): PokemonParty {
    const pokemon = [...party.pokemon];
    const sourcePokemon = pokemon[sourcePosition];
    const targetPokemon = pokemon[targetPosition];

    if (!sourcePokemon) {
      throw new PokemonPartyReorderError(
        'POKEMON_NOT_IN_PARTY',
        `Pokémon at party position ${sourcePosition} does not exist`,
      );
    }

    if (!targetPokemon) {
      throw new PokemonPartyReorderError(
        'INVALID_POSITION',
        `Pokémon at party position ${targetPosition} does not exist`,
      );
    }

    pokemon[sourcePosition] = targetPokemon;
    pokemon[targetPosition] = sourcePokemon;

    return {
      pokemon,
    };
  }

  private enqueuePartyReorder<T>(
    trainerId: PokemonTrainerId,
    operation: () => Promise<T>,
  ): Promise<T> {
    const previous =
      this.partyReorderQueues.get(trainerId) ?? Promise.resolve();

    const current = previous.catch(() => undefined).then(operation);

    this.partyReorderQueues.set(trainerId, current);

    void current.then(
      () => {
        if (this.partyReorderQueues.get(trainerId) === current) {
          this.partyReorderQueues.delete(trainerId);
        }
      },
      () => {
        if (this.partyReorderQueues.get(trainerId) === current) {
          this.partyReorderQueues.delete(trainerId);
        }
      },
    );

    return current;
  }
}
