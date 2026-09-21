import Phaser from "phaser";
import {
  MAP_DATA_REGISTRY,
  POKEMON_TRAINER_SIGHT_INTERACTION_LATERAL_TOLERANCE_FACTOR,
  checkPokemonTrainerSight,
} from "@cesar-mmo/shared";

import type { MapId } from "@cesar-mmo/shared";
import type { NpcInstance } from "../npc/types";
import type { NpcManager } from "../npc/NpcManager";

const TRAINER_ALERT_DURATION_MS = 650;

type TrainerSightReadyHandler = (npc: NpcInstance) => void;

export class TrainerSightController {
  private readonly scene: Phaser.Scene;
  private readonly npcManager: NpcManager;
  private readonly onTrainerAggroReady: TrainerSightReadyHandler;

  private activeNpc?: NpcInstance;
  private alertText?: Phaser.GameObjects.Text;
  private alertTimer?: Phaser.Time.TimerEvent;
  private alertBlocking = false;
  private defeatedTrainerBattleIds = new Set<string>();
  private latestMapId?: MapId;
  private latestPlayerX = 0;
  private latestPlayerY = 0;

  constructor(
    scene: Phaser.Scene,
    npcManager: NpcManager,
    onTrainerAggroReady: TrainerSightReadyHandler
  ) {
    this.scene = scene;
    this.npcManager = npcManager;
    this.onTrainerAggroReady = onTrainerAggroReady;
  }

  public get isBlockingGameplay(): boolean {
    return this.alertBlocking;
  }

  public setDefeatedTrainerBattleIds(trainerBattleIds: readonly string[]): void {
    this.defeatedTrainerBattleIds = new Set(trainerBattleIds);

    if (
      this.activeNpc?.definition.trainerBattleId &&
      this.defeatedTrainerBattleIds.has(this.activeNpc.definition.trainerBattleId)
    ) {
      this.clear();
    }
  }

  public update(
    mapId: MapId,
    playerX: number,
    playerY: number,
    externallyBlocked: boolean
  ): void {
    this.latestMapId = mapId;
    this.latestPlayerX = playerX;
    this.latestPlayerY = playerY;

    if (this.activeNpc) {
      if (this.alertBlocking) {
        return;
      }

      if (this.canNpcSeePlayer(this.activeNpc, mapId, playerX, playerY)) {
        return;
      }

      this.activeNpc = undefined;
    }

    if (externallyBlocked) {
      return;
    }

    for (const npc of this.npcManager.getTrainerBattleNpcs()) {
      const trainerBattleId = npc.definition.trainerBattleId;

      if (trainerBattleId && this.defeatedTrainerBattleIds.has(trainerBattleId)) {
        continue;
      }

      if (!this.canNpcSeePlayer(npc, mapId, playerX, playerY)) {
        continue;
      }

      this.triggerTrainerAlert(npc);
      return;
    }
  }

  public clear(): void {
    this.alertTimer?.remove(false);
    this.alertTimer = undefined;

    this.alertText?.destroy();
    this.alertText = undefined;

    this.activeNpc = undefined;
    this.alertBlocking = false;
  }

  public destroy(): void {
    this.clear();
  }

  private canNpcSeePlayer(
    npc: NpcInstance,
    mapId: MapId,
    playerX: number,
    playerY: number
  ): boolean {
    const sightRangeTiles = npc.definition.sightRangeTiles;

    if (!sightRangeTiles) {
      return false;
    }

    const map = MAP_DATA_REGISTRY[mapId];

    const trainer = {
      position: {
        x: npc.sprite.x,
        y: npc.sprite.y,
      },
      direction: npc.definition.direction,
      sightRangeTiles,
    };

    // 1. Primero mantenemos exactamente la validación actual.
    const strictResult = checkPokemonTrainerSight({
      trainer,
      target: {
        x: playerX,
        y: playerY,
      },
      map,
    });

    if (strictResult.detected) {
      return true;
    }

    /*
     * Keep client detection aligned with the authoritative interaction
     * envelope. Strict sight stays crisp, while this second pass absorbs
     * prediction/reconciliation and sub-tile movement differences.
     */
    const direction = npc.definition.direction;
    const horizontal = direction === "left" || direction === "right";
    const laneSize = horizontal ? map.tileHeight : map.tileWidth;

    const tolerantResult = checkPokemonTrainerSight({
      trainer,
      target: {
        x: playerX,
        y: playerY,
      },
      map,
      lateralTolerancePixels:
        laneSize * POKEMON_TRAINER_SIGHT_INTERACTION_LATERAL_TOLERANCE_FACTOR,
    });

    return tolerantResult.detected;
  }
  private triggerTrainerAlert(npc: NpcInstance): void {
    this.activeNpc = npc;
    this.alertBlocking = true;

    this.alertText?.destroy();
    const alertText = this.scene.add
      .text(Math.round(npc.sprite.x), Math.round(npc.sprite.y - 27), "!", {
        fontFamily: "Arial",
        fontSize: "18px",
        fontStyle: "bold",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5, 1)
      .setDepth(30);

    this.alertText = alertText;

    this.scene.tweens.add({
      targets: alertText,
      y: alertText.y - 5,
      duration: 140,
      yoyo: true,
      ease: "Quad.Out",
    });

    this.alertTimer?.remove(false);
    this.alertTimer = this.scene.time.delayedCall(TRAINER_ALERT_DURATION_MS, () => {
      const detectedNpc = this.activeNpc;

      this.alertText?.destroy();
      this.alertText = undefined;
      this.alertTimer = undefined;
      this.alertBlocking = false;

      if (!detectedNpc) {
        return;
      }

      /*
       * Mobile analog movement can briefly predict the player into the
       * Trainer lane before server reconciliation settles. Re-check the
       * latest local position after the alert animation so we do not start
       * a dialogue from a stale/transient sight hit and then wait for the
       * pre-battle timeout.
       */
      const latestMapId = this.latestMapId;
      if (
        !latestMapId ||
        !this.canNpcSeePlayer(
          detectedNpc,
          latestMapId,
          this.latestPlayerX,
          this.latestPlayerY
        )
      ) {
        this.activeNpc = undefined;
        return;
      }

      this.onTrainerAggroReady(detectedNpc);
    });
  }
}
