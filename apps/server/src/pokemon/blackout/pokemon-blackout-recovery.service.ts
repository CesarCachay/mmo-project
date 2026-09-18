import { Injectable } from '@nestjs/common';

import type { MapId, PokemonTrainerState } from '@cesar-mmo/shared';

import type { PokemonTrainerId } from '../pokemon-trainer-identity';

import { PokemonCenterHealingService } from '../healing/pokemon-center-healing.service';

import { PlayerWorldRuntimeStore } from '../../game/world/player-world-runtime.store';

import { PlayerWorldStateService } from '../../game/world/player-world-state.service';

import { PlayerRecoveryCheckpointService } from '../../game/world/player-recovery-checkpoint.service';

import type {
  PlayerRecoveryCheckpoint,
  PlayerWorldLocation,
} from '../../game/world/player-world.types';

export interface PokemonBlackoutRecoveryInput {
  readonly playerId: string;
  readonly trainerId: PokemonTrainerId;
}

export interface PokemonBlackoutRecoveryResult {
  readonly playerId: string;
  readonly trainerId: PokemonTrainerId;

  readonly fromMapId: MapId;

  readonly recoveryLocation: PlayerRecoveryCheckpoint;

  readonly trainerState: PokemonTrainerState;

  readonly runtimeRelocated: boolean;
}

@Injectable()
export class PokemonBlackoutRecoveryService {
  private readonly activeRecoveries = new Map<
    PokemonTrainerId,
    Promise<PokemonBlackoutRecoveryResult>
  >();

  private readonly recoveringPlayerIds = new Set<string>();

  constructor(
    private readonly healingService: PokemonCenterHealingService,

    private readonly recoveryCheckpointService: PlayerRecoveryCheckpointService,

    private readonly playerWorldStateService: PlayerWorldStateService,

    private readonly playerWorldRuntimeStore: PlayerWorldRuntimeStore,
  ) {}

  public isPlayerRecovering(playerId: string): boolean {
    return this.recoveringPlayerIds.has(playerId);
  }

  public recover(
    input: PokemonBlackoutRecoveryInput,
  ): Promise<PokemonBlackoutRecoveryResult> {
    const existing = this.activeRecoveries.get(input.trainerId);

    if (existing) {
      return existing;
    }

    this.recoveringPlayerIds.add(input.playerId);

    const recovery = this.executeRecovery(input).finally(() => {
      this.activeRecoveries.delete(input.trainerId);

      this.recoveringPlayerIds.delete(input.playerId);
    });

    this.activeRecoveries.set(input.trainerId, recovery);

    return recovery;
  }

  private async executeRecovery(
    input: PokemonBlackoutRecoveryInput,
  ): Promise<PokemonBlackoutRecoveryResult> {
    const { playerId, trainerId } = input;

    const player = this.playerWorldRuntimeStore.getPlayer(playerId);

    if (!player) {
      throw new Error(
        `Cannot recover blackout because player "${playerId}" is not in world runtime`,
      );
    }

    /*
     * --------------------------------------------------
     * 1. Snapshot location before recovery
     * --------------------------------------------------
     *
     * Used only to repair persistence if healing fails
     * after we already persisted the recovery location.
     */

    const previousLocation: PlayerWorldLocation = {
      mapId: player.mapId,
      x: player.x,
      y: player.y,
      direction: player.direction,
    };

    const fromMapId = player.mapId;

    /*
     * --------------------------------------------------
     * 2. Resolve authoritative recovery checkpoint
     * --------------------------------------------------
     *
     * Last Pokémon Center if one exists.
     *
     * Otherwise:
     * town-01 canonical spawn.
     */

    const recoveryLocation =
      await this.recoveryCheckpointService.loadRecoveryCheckpoint(trainerId);

    /*
     * --------------------------------------------------
     * 3. Durable world location FIRST
     * --------------------------------------------------
     *
     * Do not mutate runtime yet.
     *
     * If this fails, the Trainer remains wiped and the
     * next recovery attempt can retry safely.
     */

    await this.playerWorldStateService.saveLocation(
      trainerId,
      recoveryLocation,
    );

    /*
     * --------------------------------------------------
     * 4. Heal Party
     * --------------------------------------------------
     *
     * Reuse Pokémon Center healing domain.
     *
     * PostgreSQL FIRST
     * TrainerState RAM SECOND
     */

    let healingResult: Awaited<
      ReturnType<PokemonCenterHealingService['healParty']>
    >;

    try {
      healingResult = await this.healingService.healParty(trainerId);
    } catch (error: unknown) {
      /*
       * Location already points at recovery.
       *
       * Best effort: restore the previous persisted
       * location so durable state matches runtime.
       */

      try {
        await this.playerWorldStateService.saveLocation(
          trainerId,
          previousLocation,
        );
      } catch (rollbackError: unknown) {
        console.error(
          '[BlackoutRecovery] failed to rollback world location after healing failure',
          {
            playerId,
            trainerId,
            previousLocation,
            recoveryLocation,
            rollbackError,
          },
        );
      }

      throw error;
    }

    /*
     * --------------------------------------------------
     * 5. Player may have disconnected while awaiting DB
     * --------------------------------------------------
     *
     * In that case:
     *
     * durable location = safe location
     * Party = healed
     *
     * Reconnect will restore everything correctly.
     */

    const activePlayer = this.playerWorldRuntimeStore.getPlayer(playerId);

    if (!activePlayer) {
      return {
        playerId,
        trainerId,
        fromMapId,
        recoveryLocation,
        trainerState: healingResult.trainerState,
        runtimeRelocated: false,
      };
    }

    /*
     * --------------------------------------------------
     * 6. Authoritative runtime relocation
     * --------------------------------------------------
     */

    this.playerWorldRuntimeStore.movePlayerToMap(
      playerId,
      recoveryLocation.mapId,
    );

    activePlayer.x = recoveryLocation.x;

    activePlayer.y = recoveryLocation.y;

    activePlayer.direction = recoveryLocation.direction;

    activePlayer.isMoving = false;

    /*
     * Neutral input prevents the Trainer from continuing
     * to walk immediately after respawn because of an old
     * input packet.
     */

    this.playerWorldRuntimeStore.setInput(playerId, {
      sequence: activePlayer.lastProcessedInputSequence,

      up: false,
      down: false,
      left: false,
      right: false,
    });

    return {
      playerId,
      trainerId,
      fromMapId,

      recoveryLocation,

      trainerState: healingResult.trainerState,

      runtimeRelocated: true,
    };
  }
}
