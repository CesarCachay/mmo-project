import type { Socket } from 'socket.io';

import {
  POKEMON_EVENTS,
  isPokemonStorageOpenInput,
  isPokemonStorageCommand,
} from '@cesar-mmo/shared';

import type {
  PokemonStorageStatePayload,
  PokemonStorageErrorPayload,
  PokemonStorageErrorCode,
} from '@cesar-mmo/shared';

import type { PokemonTrainerId } from '../pokemon-trainer-identity';

import { PokemonStorageService } from './pokemon-storage.service';

import { PokemonStoragePersistenceError } from './pokemon-storage.repository';

import { PokemonStorageAccessSessionStore } from './pokemon-storage-access-session.store';

import { PokemonTrainerStateNetworkPresenter } from '../network/PokemonTrainerStateNetworkPresenter';

import { PlayerWorldRuntimeStore } from '../../game/world/player-world-runtime.store';

import { PokemonBattleSessionStore } from '../battles/pokemon-battle-session.store';

import {
  getServerMapStorageTerminal,
  isPlayerNearMapStorageTerminal,
} from '../../game/maps/serverMapRegistry';

type PokemonStorageServiceState = Awaited<
  ReturnType<PokemonStorageService['getState']>
>;

export interface PokemonStorageNetworkControllerOptions {
  readonly storageService: PokemonStorageService;
  readonly storageAccessSessionStore: PokemonStorageAccessSessionStore;
  readonly trainerStatePresenter: PokemonTrainerStateNetworkPresenter;
  readonly playerWorldRuntimeStore: PlayerWorldRuntimeStore;
  readonly dialogueSessionStore: {
    has(playerId: string): boolean;
  };
  readonly battleSessionStore: PokemonBattleSessionStore;
  readonly resolveTrainerId: (playerId: string) => PokemonTrainerId | undefined;
}

export class PokemonStorageNetworkController {
  private readonly storageService: PokemonStorageService;
  private readonly storageAccessSessionStore: PokemonStorageAccessSessionStore;
  private readonly trainerStatePresenter: PokemonTrainerStateNetworkPresenter;
  private readonly playerWorldRuntimeStore: PlayerWorldRuntimeStore;
  private readonly dialogueSessionStore: PokemonStorageNetworkControllerOptions['dialogueSessionStore'];
  private readonly battleSessionStore: PokemonBattleSessionStore;
  private readonly resolveTrainerId: PokemonStorageNetworkControllerOptions['resolveTrainerId'];

  constructor(options: PokemonStorageNetworkControllerOptions) {
    this.storageService = options.storageService;
    this.storageAccessSessionStore = options.storageAccessSessionStore;
    this.trainerStatePresenter = options.trainerStatePresenter;
    this.playerWorldRuntimeStore = options.playerWorldRuntimeStore;
    this.dialogueSessionStore = options.dialogueSessionStore;
    this.battleSessionStore = options.battleSessionStore;
    this.resolveTrainerId = options.resolveTrainerId;
  }

  public async handleOpen(client: Socket, payload: unknown): Promise<void> {
    if (!isPokemonStorageOpenInput(payload)) {
      this.emitError(
        client,
        'INVALID_COMMAND',
        'Invalid Pokémon Storage request.',
      );

      return;
    }

    const player = this.playerWorldRuntimeStore.getPlayer(client.id);
    const trainerId = this.resolveTrainerId(client.id);

    if (!player || !trainerId) {
      this.emitError(
        client,
        'STORAGE_NOT_AVAILABLE',
        'Pokémon Storage is not available.',
      );

      return;
    }

    if (
      this.dialogueSessionStore.has(client.id) ||
      this.battleSessionStore.getByPlayerId(client.id)
    ) {
      this.emitError(
        client,
        'STORAGE_NOT_AVAILABLE',
        'Pokémon Storage cannot be used right now.',
      );

      return;
    }

    const terminal = getServerMapStorageTerminal(
      player.mapId,
      payload.terminalId,
    );

    if (
      !terminal ||
      !isPlayerNearMapStorageTerminal(player.x, player.y, terminal)
    ) {
      this.emitError(
        client,
        'STORAGE_NOT_AVAILABLE',
        'You are not close enough to this Pokémon Storage terminal.',
      );

      return;
    }

    this.storageAccessSessionStore.start(
      client.id,
      player.mapId,
      payload.terminalId,
    );

    try {
      const state = await this.storageService.getState(trainerId);

      /* Follower público + TRAINER_STATE owner-only */
      this.trainerStatePresenter.publishTrainerState(
        client,
        state.trainerState,
      );

      this.emitStorageState(client, state);
    } catch (error: unknown) {
      this.storageAccessSessionStore.remove(client.id);

      console.warn(
        `[PokemonStorage] Open rejected for player ${client.id}`,
        error,
      );

      this.emitError(
        client,
        'STORAGE_NOT_AVAILABLE',
        'Pokémon Storage could not be opened.',
      );
    }
  }

  public handleClose(client: Socket): void {
    this.storageAccessSessionStore.remove(client.id);
  }

  public async handleCommand(client: Socket, payload: unknown): Promise<void> {
    if (!isPokemonStorageCommand(payload)) {
      this.emitError(
        client,
        'INVALID_COMMAND',
        'Invalid Pokémon Storage command.',
      );

      return;
    }

    const access = this.resolveAccess(client.id);

    if (!access) {
      this.emitError(
        client,
        'STORAGE_NOT_AVAILABLE',
        'Pokémon Storage access is no longer available.',
      );

      return;
    }

    try {
      let state: PokemonStorageServiceState | undefined;

      switch (payload.type) {
        case 'withdraw':
          state = await this.storageService.withdraw(
            access.trainerId,
            payload.pokemonInstanceId,
          );
          break;

        case 'deposit':
          state = await this.storageService.deposit(
            access.trainerId,
            payload.pokemonInstanceId,
          );
          break;

        case 'swap':
          state = await this.storageService.swap(
            access.trainerId,
            payload.storedPokemonInstanceId,
            payload.partyPokemonInstanceId,
          );
          break;
      }

      this.trainerStatePresenter.publishTrainerState(
        client,
        state.trainerState,
      );

      this.emitStorageState(client, state);
    } catch (error: unknown) {
      if (error instanceof PokemonStoragePersistenceError) {
        this.emitError(client, error.code, error.message);

        return;
      }

      console.warn(
        `[PokemonStorage] Command rejected for player ${client.id}`,
        error,
      );

      this.emitError(
        client,
        'STORAGE_NOT_AVAILABLE',
        'Pokémon Storage command failed.',
      );
    }
  }

  private resolveAccess(playerId: string):
    | {
        trainerId: PokemonTrainerId;
      }
    | undefined {
    const player = this.playerWorldRuntimeStore.getPlayer(playerId);

    if (!player) {
      return undefined;
    }

    const trainerId = this.resolveTrainerId(playerId);

    if (!trainerId) {
      return undefined;
    }

    /* Si durante la sesión PC empieza Battle o Dialogue invalidamos inmediatamente el acceso */
    if (this.battleSessionStore.getByPlayerId(playerId)) {
      this.storageAccessSessionStore.remove(playerId);

      return undefined;
    }

    if (this.dialogueSessionStore.has(playerId)) {
      this.storageAccessSessionStore.remove(playerId);

      return undefined;
    }

    const session = this.storageAccessSessionStore.get(playerId);

    if (!session) {
      return undefined;
    }

    /* Debe continuar en el mismo mapa en el que abrió la PC. */
    if (session.mapId !== player.mapId) {
      this.storageAccessSessionStore.remove(playerId);

      return undefined;
    }

    const terminal = getServerMapStorageTerminal(
      player.mapId,
      session.terminalId,
    );

    if (!terminal) {
      this.storageAccessSessionStore.remove(playerId);

      return undefined;
    }

    /* Revalidamos proximidad en CADA command */
    if (!isPlayerNearMapStorageTerminal(player.x, player.y, terminal)) {
      this.storageAccessSessionStore.remove(playerId);
      return undefined;
    }

    return {
      trainerId,
    };
  }

  private emitStorageState(
    client: Socket,
    state: PokemonStorageServiceState,
  ): void {
    client.emit(POKEMON_EVENTS.STORAGE_STATE, {
      party: state.trainerState.party,
      storage: state.storage,
    } satisfies PokemonStorageStatePayload);
  }

  private emitError(
    client: Socket,
    code: PokemonStorageErrorCode,
    message: string,
  ): void {
    client.emit(POKEMON_EVENTS.STORAGE_ERROR, {
      code,
      message,
    } satisfies PokemonStorageErrorPayload);
  }
}
