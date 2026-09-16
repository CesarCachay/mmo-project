import Phaser from "phaser";

import {
  MAP_DATA_REGISTRY,
  type MapId,
  type SharedMapHealingStation,
} from "@cesar-mmo/shared";

const MACHINE_FX_OFFSET_Y = -52;

const WORLD_FX_DEPTH = 9;

const GLOW_COLOR = 0x67e8f9;
const CORE_COLOR = 0xe0f2fe;
const RING_COLOR = 0x7dd3fc;

export class PokemonCenterHealingWorldFxController {
  private readonly scene: Phaser.Scene;

  private container?: Phaser.GameObjects.Container;
  private glow?: Phaser.GameObjects.Arc;
  private core?: Phaser.GameObjects.Arc;
  private ring?: Phaser.GameObjects.Arc;
  private cleanupTimer?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public begin(mapId: MapId, healingStationId: string): void {
    this.cancel();

    const healingStations: Readonly<Record<string, SharedMapHealingStation>> =
      MAP_DATA_REGISTRY[mapId].healingStations;

    const station = healingStations[healingStationId];

    if (!station) {
      console.warn("[PokemonCenterHealingFX] healing station not found", {
        mapId,
        healingStationId,
      });

      return;
    }

    const machineX = station.x;

    const machineY = station.y + MACHINE_FX_OFFSET_Y;

    this.glow = this.scene.add
      .circle(0, 0, 24, GLOW_COLOR, 0.14)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.ring = this.scene.add
      .circle(0, 0, 18, GLOW_COLOR, 0)
      .setStrokeStyle(2, RING_COLOR, 0.85)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.core = this.scene.add
      .circle(0, 0, 7, CORE_COLOR, 0.7)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.container = this.scene.add.container(machineX, machineY, [
      this.glow,
      this.ring,
      this.core,
    ]);

    this.container.setDepth(WORLD_FX_DEPTH);

    this.startIdlePulse();
  }

  public pulseStep(stepNumber: number, totalSteps: number): void {
    if (!this.container || !this.core || !this.glow) {
      return;
    }

    this.scene.tweens.killTweensOf(this.core);

    this.core.setAlpha(1).setScale(1);

    this.scene.tweens.add({
      targets: this.core,
      scaleX: 1.8,
      scaleY: 1.8,
      alpha: 1,
      duration: 90,
      yoyo: true,
      ease: "Quad.easeOut",
    });

    this.scene.tweens.killTweensOf(this.glow);

    this.scene.tweens.add({
      targets: this.glow,
      scaleX: 1.35,
      scaleY: 1.35,
      alpha: 0.32,
      duration: 100,
      yoyo: true,
      ease: "Quad.easeOut",
      onComplete: () => {
        this.startGlowPulse();
      },
    });

    this.spawnStepSparkle(stepNumber, totalSteps);
  }

  public complete(): void {
    if (!this.container || !this.glow || !this.core || !this.ring) {
      return;
    }

    this.killFxTweens();

    this.glow.setAlpha(0.4).setScale(1);

    this.core.setAlpha(1).setScale(1);

    this.ring.setAlpha(1).setScale(0.75);

    /* Explosión luminosa principal */
    this.scene.tweens.add({
      targets: this.glow,
      scaleX: 1.75,
      scaleY: 1.75,
      alpha: 0,
      duration: 480,
      ease: "Quad.easeOut",
    });

    this.scene.tweens.add({
      targets: this.core,
      scaleX: 2.2,
      scaleY: 2.2,
      alpha: 0,
      duration: 360,
      ease: "Quad.easeOut",
    });

    this.scene.tweens.add({
      targets: this.ring,
      scaleX: 2.1,
      scaleY: 2.1,
      alpha: 0,
      duration: 500,
      ease: "Cubic.easeOut",
    });

    this.spawnCompletionBurst();

    this.cleanupTimer = this.scene.time.delayedCall(650, () => {
      this.cleanupTimer = undefined;
      this.cancel();
    });
  }

  public cancel(): void {
    this.cleanupTimer?.remove(false);
    this.cleanupTimer = undefined;
    this.killFxTweens();

    if (this.container) {
      for (const child of this.container.list) {
        this.scene.tweens.killTweensOf(child);
      }
      this.container.destroy(true);
    }

    this.container = undefined;
    this.glow = undefined;
    this.core = undefined;
    this.ring = undefined;
  }

  public destroy(): void {
    this.cancel();
  }

  private startIdlePulse(): void {
    this.startGlowPulse();

    if (!this.ring) {
      return;
    }

    this.scene.tweens.add({
      targets: this.ring,
      scaleX: {
        from: 0.8,
        to: 1.5,
      },
      scaleY: {
        from: 0.8,
        to: 1.5,
      },
      alpha: {
        from: 0.8,
        to: 0,
      },
      duration: 720,
      repeat: -1,
      ease: "Quad.easeOut",
    });
  }

  private startGlowPulse(): void {
    if (!this.glow) {
      return;
    }

    this.scene.tweens.killTweensOf(this.glow);

    this.glow.setScale(1).setAlpha(0.14);

    this.scene.tweens.add({
      targets: this.glow,
      scaleX: 1.22,
      scaleY: 1.22,
      alpha: 0.24,
      duration: 360,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private spawnStepSparkle(stepNumber: number, totalSteps: number): void {
    if (!this.container) {
      return;
    }

    const safeTotal = Math.max(1, totalSteps);

    const normalizedStep = Math.max(0, stepNumber - 1);

    const angle = Phaser.Math.DegToRad(-150 + (normalizedStep / safeTotal) * 300);

    const startRadius = 13;

    const startX = Math.cos(angle) * startRadius;

    const startY = Math.sin(angle) * 9;

    const sparkle = this.scene.add
      .circle(startX, startY, 3, CORE_COLOR, 1)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.container.add(sparkle);

    this.scene.tweens.add({
      targets: sparkle,
      x: startX + Math.cos(angle) * 12,
      y: startY - 14,
      scaleX: 0.2,
      scaleY: 0.2,
      alpha: 0,
      duration: 360,
      ease: "Quad.easeOut",
      onComplete: () => {
        sparkle.destroy();
      },
    });
  }

  private spawnCompletionBurst(): void {
    if (!this.container) {
      return;
    }

    const particleCount = 10;

    for (let index = 0; index < particleCount; index += 1) {
      const angle = (Math.PI * 2 * index) / particleCount;

      const particle = this.scene.add
        .circle(0, 0, index % 2 === 0 ? 3 : 2, CORE_COLOR, 1)
        .setBlendMode(Phaser.BlendModes.ADD);

      this.container.add(particle);

      const distance = index % 2 === 0 ? 30 : 24;

      this.scene.tweens.add({
        targets: particle,
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance - 5,
        scaleX: 0.15,
        scaleY: 0.15,
        alpha: 0,
        duration: 400 + index * 18,
        ease: "Cubic.easeOut",
        onComplete: () => {
          particle.destroy();
        },
      });
    }
  }

  private killFxTweens(): void {
    if (this.glow) {
      this.scene.tweens.killTweensOf(this.glow);
    }

    if (this.core) {
      this.scene.tweens.killTweensOf(this.core);
    }

    if (this.ring) {
      this.scene.tweens.killTweensOf(this.ring);
    }
  }
}
