import Phaser from "phaser";

import type { MapId, MapTransitionResolved } from "@cesar-mmo/shared";

type MapExitZone = {
  id: string;
  bounds: Phaser.Geom.Rectangle;
};

type RequestTransition = (transitionId: string) => void;

type ApplyResolvedTransition = (transition: MapTransitionResolved) => void;

type TransitionStarted = () => void;

export class MapTransitionController {
  private readonly scene: Phaser.Scene;
  private readonly onRequestTransition: RequestTransition;
  private readonly onApplyResolvedTransition: ApplyResolvedTransition;
  private readonly onTransitionStarted: TransitionStarted;

  private mapExitZones: MapExitZone[] = [];
  private activeMapExitId: string | null = null;

  private lastMapTransitionRequestAt = 0;
  private readonly retryDelayMs = 200;
  private transitioning = false;
  private readonly fadeDurationMs = 250;

  constructor(
    scene: Phaser.Scene,
    onRequestTransition: RequestTransition,
    onApplyResolvedTransition: ApplyResolvedTransition,
    onTransitionStarted: TransitionStarted
  ) {
    this.scene = scene;
    this.onRequestTransition = onRequestTransition;
    this.onApplyResolvedTransition = onApplyResolvedTransition;
    this.onTransitionStarted = onTransitionStarted;
  }

  public get isTransitioning(): boolean {
    return this.transitioning;
  }

  public loadZones(map: Phaser.Tilemaps.Tilemap): void {
    this.mapExitZones = [];
    this.resetExitTracking();

    const objectsLayer = map.getObjectLayer("Objects");

    if (!objectsLayer) {
      console.log("[MapExit] Objects layer not found");
      return;
    }

    for (const object of objectsLayer.objects) {
      if (object.type !== "mapExit") {
        continue;
      }
      if (
        !object.name ||
        typeof object.x !== "number" ||
        typeof object.y !== "number" ||
        typeof object.width !== "number" ||
        typeof object.height !== "number"
      ) {
        continue;
      }
      if (object.width <= 0 || object.height <= 0) {
        continue;
      }

      this.mapExitZones.push({
        id: object.name,
        bounds: new Phaser.Geom.Rectangle(
          object.x,
          object.y,
          object.width,
          object.height
        ),
      });
    }
    console.log("[MapExit] zones loaded", this.mapExitZones);
  }

  public clearZones(): void {
    this.mapExitZones = [];
    this.resetExitTracking();
  }

  public resetExitTracking(): void {
    this.activeMapExitId = null;
    this.lastMapTransitionRequestAt = 0;
  }

  public update(playerX: number, playerY: number): void {
    if (this.transitioning) {
      return;
    }
    const currentExit = this.mapExitZones.find((exitZone) =>
      exitZone.bounds.contains(playerX, playerY)
    );
    if (!currentExit) {
      this.resetExitTracking();
      return;
    }

    const now = this.scene.time.now;

    // Primera entrada al exit.
    if (this.activeMapExitId !== currentExit.id) {
      this.activeMapExitId = currentExit.id;
      this.lastMapTransitionRequestAt = now;
      console.log("[MapExit] entered", currentExit.id);
      this.onRequestTransition(currentExit.id);
      return;
    }

    // Seguimos dentro del mismo exit. Permitir retry del server
    if (now - this.lastMapTransitionRequestAt < this.retryDelayMs) {
      return;
    }

    this.lastMapTransitionRequestAt = now;
    this.onRequestTransition(currentExit.id);
  }

  public handleResolved(transition: MapTransitionResolved, currentMapId: MapId): void {
    if (transition.fromMapId !== currentMapId) {
      return;
    }
    if (!this.beginTransition()) {
      return;
    }

    this.onTransitionStarted();
    this.startFadeOut(transition);
  }

  private beginTransition(): boolean {
    if (this.transitioning) {
      return false;
    }
    this.transitioning = true;
    return true;
  }

  private finishTransition(): void {
    this.transitioning = false;
  }

  private startFadeOut(transition: MapTransitionResolved): void {
    const camera = this.scene.cameras.main;
    camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      try {
        this.onApplyResolvedTransition(transition);
      } catch (error) {
        console.error("[MapTransition] Failed while changing map", error);
      }
      this.startFadeIn();
    });
    camera.fadeOut(this.fadeDurationMs, 0, 0, 0);
  }

  private startFadeIn(): void {
    const camera = this.scene.cameras.main;
    camera.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => {
      this.finishTransition();
    });
    camera.fadeIn(this.fadeDurationMs, 0, 0, 0);
  }
}
