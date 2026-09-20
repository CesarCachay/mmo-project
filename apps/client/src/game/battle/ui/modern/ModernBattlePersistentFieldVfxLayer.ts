import {
  hasPersistentBattleFieldEffects,
  type BattleFieldState,
  type BattleInstance,
  type BattleSide,
} from "@cesar-mmo/shared";

import { drawPersistentBattlefieldEffects } from "../../vfx/effects/battlefield/PersistentBattlefieldEffectRenderer";
import {
  getBattleCanvasPixelRatio,
  getBattleVfxPerformanceProfile,
} from "../../vfx/performance/battle-vfx-performance";

interface PersistentFieldRenderState {
  readonly fieldState: BattleFieldState;
  readonly localSide: BattleSide;
  readonly opponentSide: BattleSide;
  readonly animated: boolean;
}

export class ModernBattlePersistentFieldVfxLayer {
  private readonly root: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly resizeObserver?: ResizeObserver;
  private renderState?: PersistentFieldRenderState;
  private frameHandle?: number;
  private lastRenderedAt = 0;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "battle-persistent-field-vfx";
    this.root.setAttribute("aria-hidden", "true");

    this.canvas = document.createElement("canvas");
    this.canvas.className = "battle-persistent-field-vfx__canvas";

    const context = this.canvas.getContext("2d");

    if (!context) {
      throw new Error("Persistent Battle Field VFX requires Canvas 2D support");
    }

    this.context = context;
    this.root.appendChild(this.canvas);
    parent.appendChild(this.root);

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => {
        if (this.renderState) {
          this.renderCurrentFrame(performance.now());
        }
      });
      this.resizeObserver.observe(this.root);
    }
  }

  public syncBattle(battle: BattleInstance, localParticipantId: string): void {
    const localParticipant = battle.participants.find(
      (participant) => participant.id === localParticipantId,
    );
    const opponentParticipant = battle.participants.find(
      (participant) => participant.id !== localParticipantId,
    );

    if (
      !localParticipant ||
      !opponentParticipant ||
      !battle.fieldState ||
      !hasPersistentBattleFieldEffects(battle.fieldState)
    ) {
      this.clear();
      return;
    }

    this.renderState = {
      fieldState: battle.fieldState,
      localSide: localParticipant.side,
      opponentSide: opponentParticipant.side,
      animated: hasAnimatedPersistentFieldEffects(
        battle.fieldState,
        localParticipant.side,
        opponentParticipant.side,
      ),
    };

    this.renderCurrentFrame(performance.now());

    if (this.renderState.animated) {
      this.startRendering();
    } else {
      this.stopRendering();
    }
  }

  public clear(): void {
    this.renderState = undefined;
    this.stopRendering();
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  public destroy(): void {
    this.clear();
    this.resizeObserver?.disconnect();
    this.root.remove();
  }

  private startRendering(): void {
    if (this.frameHandle !== undefined) {
      return;
    }

    this.frameHandle = window.requestAnimationFrame(this.renderFrame);
  }

  private stopRendering(): void {
    if (this.frameHandle !== undefined) {
      window.cancelAnimationFrame(this.frameHandle);
      this.frameHandle = undefined;
    }

    this.lastRenderedAt = 0;
  }

  private readonly renderFrame = (now: number): void => {
    this.frameHandle = undefined;

    const renderState = this.renderState;
    if (!renderState || !renderState.animated) {
      return;
    }

    const performanceProfile = getBattleVfxPerformanceProfile();
    const minFrameIntervalMs = 1000 / performanceProfile.persistentFps;

    if (
      this.lastRenderedAt === 0 ||
      now - this.lastRenderedAt >= minFrameIntervalMs
    ) {
      this.renderCurrentFrame(now);
    }

    this.frameHandle = window.requestAnimationFrame(this.renderFrame);
  };

  private renderCurrentFrame(now: number): void {
    const renderState = this.renderState;
    if (!renderState) {
      return;
    }

    const size = this.syncCanvasSize();
    this.context.clearRect(0, 0, size.width, size.height);

    if (size.width <= 0 || size.height <= 0) {
      return;
    }

    const performanceProfile = getBattleVfxPerformanceProfile();

    drawPersistentBattlefieldEffects({
      ctx: this.context,
      width: size.width,
      height: size.height,
      fieldState: renderState.fieldState,
      localSide: renderState.localSide,
      opponentSide: renderState.opponentSide,
      now,
      reducedMotion: performanceProfile.reducedMotion,
      particleScale: performanceProfile.particleScale,
    });

    this.lastRenderedAt = now;
  }

  private syncCanvasSize(): { width: number; height: number } {
    const bounds = this.root.getBoundingClientRect();
    const width = Math.max(0, bounds.width);
    const height = Math.max(0, bounds.height);
    const pixelRatio = getBattleCanvasPixelRatio();
    const pixelWidth = Math.max(1, Math.round(width * pixelRatio));
    const pixelHeight = Math.max(1, Math.round(height * pixelRatio));

    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
    }

    this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    return { width, height };
  }
}

function hasAnimatedPersistentFieldEffects(
  fieldState: BattleFieldState,
  localSide: BattleSide,
  opponentSide: BattleSide,
): boolean {
  if (fieldState.weather) {
    return true;
  }

  if (
    fieldState.effects.trickRoomRemainingTurns > 0 ||
    fieldState.effects.gravityRemainingTurns > 0
  ) {
    return true;
  }

  return (
    fieldState.hazards[localSide].stealthRock ||
    fieldState.hazards[opponentSide].stealthRock
  );
}
