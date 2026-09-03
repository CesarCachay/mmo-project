import {
  MAX_POKEMON_PARTY_SIZE,
  addPokemonToParty,
  consumePokemonInventoryItem,
} from '@cesar-mmo/shared';

import type {
  PokemonInstance,
  PokemonItemId,
  PokemonTrainerState,
} from '@cesar-mmo/shared';

import type { PokemonTrainerId } from 'src/pokemon/pokemon-trainer-identity';
import { PokemonTrainerStateStore } from 'src/pokemon/pokemon-trainer-state.store';
import { PokemonCaptureRepository } from './pokemon-capture.repository';

export interface PersistSuccessfulPokemonCaptureResult {
  readonly trainerState: PokemonTrainerState;

  /**
   * null means the captured Pokémon went to
   * implicit Storage rather than active Party.
   */
  readonly partyPosition: number | null;
}

export class PokemonCaptureService {
  constructor(
    private readonly trainerStateStore: PokemonTrainerStateStore,
    private readonly captureRepository: PokemonCaptureRepository,
  ) {}

  public async persistSuccessfulCapture(
    trainerId: PokemonTrainerId,
    itemId: PokemonItemId,
    capturedPokemon: PokemonInstance,
  ): Promise<PersistSuccessfulPokemonCaptureResult> {
    const trainerState = this.trainerStateStore.get(trainerId);

    if (!trainerState) {
      throw new Error(
        `Pokémon Trainer state not found for trainer "${trainerId}"`,
      );
    }

    /* Pure computation only No RAM mutation yet. */
    const updatedInventory = consumePokemonInventoryItem(
      trainerState.inventory,
      itemId,
      1,
    );

    const partyHasRoom =
      trainerState.party.pokemon.length < MAX_POKEMON_PARTY_SIZE;

    const partyPosition = partyHasRoom
      ? trainerState.party.pokemon.length
      : null;

    const updatedParty =
      partyPosition !== null
        ? addPokemonToParty(trainerState.party, capturedPokemon)
        : trainerState.party;

    /*
     * PostgreSQL FIRST.
     * The Repository also validates Inventory and Party state inside the transaction.
     */
    await this.captureRepository.persistSuccessfulCapture({
      trainerId,
      itemId,
      capturedPokemon,
      expectedPartyPosition: partyPosition,
    });

    /* Only AFTER successful COMMIT */
    const updatedTrainerState = this.trainerStateStore.setPartyAndInventory(
      trainerId,
      updatedParty,
      updatedInventory,
    );

    return {
      trainerState: updatedTrainerState,
      partyPosition,
    };
  }
}
