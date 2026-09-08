import type { Socket } from 'socket.io';

import { POKEMON_EVENTS } from '@cesar-mmo/shared';

import type {
  PokemonFollowerPublicState,
  PokemonTrainerState,
  PokemonTrainerStatePayload,
} from '@cesar-mmo/shared';

import { PlayerWorldRuntimeStore } from '../../game/world/player-world-runtime.store';

export class PokemonTrainerStateNetworkPresenter {
  constructor(
    private readonly playerWorldRuntimeStore: PlayerWorldRuntimeStore,
  ) {}

  public emitTrainerState(
    client: Socket,
    trainerState: PokemonTrainerState,
  ): void {
    client.emit(POKEMON_EVENTS.TRAINER_STATE, {
      trainerState,
    } satisfies PokemonTrainerStatePayload);
  }

  public syncPlayerFollower(
    playerId: string,
    trainerState: PokemonTrainerState,
  ): void {
    const player = this.playerWorldRuntimeStore.getPlayer(playerId);

    if (!player) {
      return;
    }

    player.pokemonFollower = this.getFollowerPublicState(trainerState);
  }

  public publishTrainerState(
    client: Socket,
    trainerState: PokemonTrainerState,
  ): void {
    this.syncPlayerFollower(client.id, trainerState);
    this.emitTrainerState(client, trainerState);
  }

  private getFollowerPublicState(
    trainerState: PokemonTrainerState,
  ): PokemonFollowerPublicState | undefined {
    const pokemon = trainerState.party.pokemon[0];

    if (!pokemon) {
      return undefined;
    }

    return {
      speciesId: pokemon.speciesId,
      formId: pokemon.formId,
    };
  }
}
