import type { Socket } from 'socket.io';

import { POKEMON_CENTER_HEALING_EVENTS } from '@cesar-mmo/shared';

import type { PokemonTrainerState } from '@cesar-mmo/shared';

import { describe, expect, it, vi } from 'vitest';

import type { PokemonTrainerId } from '../../pokemon-trainer-identity';

import type { PokemonTrainerStateNetworkPresenter } from '../../network/PokemonTrainerStateNetworkPresenter';

import type { PlayerWorldRuntimeStore } from '../../../game/world/player-world-runtime.store';

import type { PokemonStorageAccessSessionStore } from '../../storage/pokemon-storage-access-session.store';

import type { PokemonWildEncounterSessionStore } from '../../encounters/pokemon-wild-encounter-session.store';

import type { PokemonBattleSessionStore } from '../../battles/pokemon-battle-session.store';

import { PokemonCenterHealingError } from '../pokemon-center-healing.service';

import type { PokemonCenterHealingService } from '../pokemon-center-healing.service';

import type { PlayerRecoveryCheckpointService } from '../../../game/world/player-recovery-checkpoint.service';

import { PokemonCenterHealingNetworkController } from '../pokemon-center-healing-network.controller';

const playerId = 'player-healing-test';

const trainerId = 'trainer-healing-test' as PokemonTrainerId;

const healingStationId = 'pokeCenterHealingStation01';

const trainerState: PokemonTrainerState = {
  party: {
    pokemon: [],
  },

  inventory: {
    items: [],
  },
};

type BlockedBy = 'dialogue' | 'storage' | 'encounter' | 'battle';

function createHarness(
  options: {
    readonly blockedBy?: BlockedBy;
    readonly nearStation?: boolean;
  } = {},
) {
  const emit = vi.fn();

  const client = {
    id: playerId,
    emit,
  } as unknown as Socket;

  const healParty = vi.fn(async () => ({
    trainerState,

    restoredPokemonCount: 2,

    totalHpRestored: 41,

    totalPpRestored: 53,
  }));

  const healingService = {
    healParty,
  } as unknown as PokemonCenterHealingService;

  const saveMapSpawnRecoveryCheckpoint = vi.fn(async () => ({
    mapId: 'poke-center' as const,
    x: 256,
    y: 344,
    direction: 'up' as const,
  }));

  const recoveryCheckpointService = {
    saveMapSpawnRecoveryCheckpoint,
  } as unknown as PlayerRecoveryCheckpointService;

  const publishTrainerState = vi.fn();

  const trainerStatePresenter = {
    publishTrainerState,
  } as unknown as PokemonTrainerStateNetworkPresenter;

  const getPlayer = vi.fn(() => ({
    id: playerId,
    mapId: 'poke-center',
    x: 256,
    y: 112,
  }));

  const playerWorldRuntimeStore = {
    getPlayer,
  } as unknown as PlayerWorldRuntimeStore;

  const dialogueHas = vi.fn(() => options.blockedBy === 'dialogue');

  const storageHas = vi.fn(() => options.blockedBy === 'storage');

  const encounterHas = vi.fn(() => options.blockedBy === 'encounter');

  const battleGet = vi.fn(() =>
    options.blockedBy === 'battle'
      ? {
          battleId: 'battle-test',
        }
      : undefined,
  );

  const dialogueSessionStore = {
    has: dialogueHas,
  };

  const storageAccessSessionStore = {
    has: storageHas,
  } as unknown as PokemonStorageAccessSessionStore;

  const wildEncounterSessionStore = {
    has: encounterHas,
  } as unknown as PokemonWildEncounterSessionStore;

  const battleSessionStore = {
    getByPlayerId: battleGet,
  } as unknown as PokemonBattleSessionStore;

  const resolveTrainerId = vi.fn(() => trainerId);

  const getHealingStation = vi.fn(() => ({
    x: 256,
    y: 96,
  }));

  const isPlayerNearHealingStation = vi.fn(() => options.nearStation ?? true);

  const controller = new PokemonCenterHealingNetworkController({
    healingService,
    recoveryCheckpointService,
    trainerStatePresenter,
    playerWorldRuntimeStore,
    dialogueSessionStore,
    storageAccessSessionStore,
    wildEncounterSessionStore,
    battleSessionStore,
    resolveTrainerId,
    getHealingStation,
    isPlayerNearHealingStation,
  });

  return {
    controller,

    saveMapSpawnRecoveryCheckpoint,

    client,

    emit,

    healParty,

    publishTrainerState,

    getPlayer,

    resolveTrainerId,

    getHealingStation,

    isPlayerNearHealingStation,
  };
}

describe('PokemonCenterHealingNetworkController', () => {
  it('rejects invalid network input before resolving gameplay state', async () => {
    const harness = createHarness();

    await harness.controller.handleHeal(harness.client, {
      healingStationId: '',
    });

    expect(harness.emit).toHaveBeenCalledWith(
      POKEMON_CENTER_HEALING_EVENTS.ERROR,
      {
        code: 'INVALID_INPUT',
      },
    );

    expect(harness.getPlayer).not.toHaveBeenCalled();

    expect(harness.healParty).not.toHaveBeenCalled();
  });

  it('rejects healing when the player is not close enough to the requested station', async () => {
    const harness = createHarness({
      nearStation: false,
    });

    await harness.controller.handleHeal(harness.client, {
      healingStationId,
    });

    expect(harness.getHealingStation).toHaveBeenCalledWith(
      'poke-center',
      healingStationId,
    );

    expect(harness.emit).toHaveBeenCalledWith(
      POKEMON_CENTER_HEALING_EVENTS.ERROR,
      {
        code: 'HEALING_NOT_AVAILABLE',
      },
    );

    expect(harness.healParty).not.toHaveBeenCalled();
  });

  it('blocks healing during dialogue, Storage, Wild Encounter, or Battle', async () => {
    const blockers: readonly BlockedBy[] = [
      'dialogue',
      'storage',
      'encounter',
      'battle',
    ];

    for (const blockedBy of blockers) {
      const harness = createHarness({
        blockedBy,
      });

      await harness.controller.handleHeal(harness.client, {
        healingStationId,
      });

      expect(harness.emit).toHaveBeenCalledWith(
        POKEMON_CENTER_HEALING_EVENTS.ERROR,
        {
          code: 'INCOMPATIBLE_STATE',
        },
      );

      expect(harness.healParty).not.toHaveBeenCalled();
    }
  });

  it('heals using the Trainer derived from the socket, publishes TrainerState, and emits the healing ACK', async () => {
    const harness = createHarness();

    await harness.controller.handleHeal(harness.client, {
      healingStationId,
    });

    expect(harness.resolveTrainerId).toHaveBeenCalledWith(playerId);

    expect(harness.healParty).toHaveBeenCalledWith(trainerId);

    expect(harness.publishTrainerState).toHaveBeenCalledWith(
      harness.client,
      trainerState,
    );

    expect(harness.emit).toHaveBeenCalledWith(
      POKEMON_CENTER_HEALING_EVENTS.HEALED,
      {
        healingStationId,

        restoredPokemonCount: 2,

        totalHpRestored: 41,

        totalPpRestored: 53,
      },
    );
  });

  it('maps service failures to stable public network error codes without publishing TrainerState', async () => {
    const cases = [
      {
        error: new PokemonCenterHealingError(
          'TRAINER_STATE_NOT_FOUND',
          'Trainer state missing',
        ),

        expectedCode: 'INCOMPATIBLE_STATE',
      },

      {
        error: new PokemonCenterHealingError(
          'PERSISTENCE_CONFLICT',
          'Persistence conflict',
        ),

        expectedCode: 'PERSISTENCE_CONFLICT',
      },

      {
        error: new PokemonCenterHealingError(
          'PERSISTENCE_FAILED',
          'Persistence failed',
        ),

        expectedCode: 'PERSISTENCE_FAILED',
      },
    ] as const;

    for (const testCase of cases) {
      const harness = createHarness();

      harness.healParty.mockRejectedValueOnce(testCase.error);

      await harness.controller.handleHeal(harness.client, {
        healingStationId,
      });

      expect(harness.emit).toHaveBeenCalledWith(
        POKEMON_CENTER_HEALING_EVENTS.ERROR,
        {
          code: testCase.expectedCode,
        },
      );

      expect(harness.publishTrainerState).not.toHaveBeenCalled();
    }
  });

  it('maps an unexpected service failure to PERSISTENCE_FAILED without publishing TrainerState', async () => {
    const harness = createHarness();

    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    harness.healParty.mockRejectedValueOnce(
      new Error('unexpected database failure'),
    );

    try {
      await harness.controller.handleHeal(harness.client, {
        healingStationId,
      });

      expect(harness.emit).toHaveBeenCalledWith(
        POKEMON_CENTER_HEALING_EVENTS.ERROR,
        {
          code: 'PERSISTENCE_FAILED',
        },
      );

      expect(harness.publishTrainerState).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });
});
