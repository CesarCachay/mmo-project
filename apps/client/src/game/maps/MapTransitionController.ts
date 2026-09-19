import Phaser from "phaser";

import type { MapId, MapTransitionResolved } from "@cesar-mmo/shared";

type MapExitZone = {
  id: string;
  bounds: Phaser.Geom.Rectangle;
};

type RequestTransition = (transitionId: string) => void;

type PrefetchTransition = (transitionId: string) => void;

type ApplyResolvedTransition = (
  transition: MapTransitionResolved
) => void | Promise<void>;

type TransitionStarted = () => void;

export class MapTransitionController {
  private readonly scene: Phaser.Scene;
  private readonly onRequestTransition: RequestTransition;
  private readonly onApplyResolvedTransition: ApplyResolvedTransition;
  private readonly onTransitionStarted: TransitionStarted;
  private readonly onPrefetchTransition: PrefetchTransition;

  private mapExitZones: MapExitZone[] = [];
  private activeMapExitId: string | null = null;
  private readonly prefetchedExitIds = new Set<string>();

  private lastMapTransitionRequestAt = 0;
  private readonly retryDelayMs = 200;
  private transitioning = false;
  private readonly fadeDurationMs = 250;
  private readonly prefetchDistancePx = 72;

  constructor(
    scene: Phaser.Scene,
    onRequestTransition: RequestTransition,
    onApplyResolvedTransition: ApplyResolvedTransition,
    onTransitionStarted: TransitionStarted,
    onPrefetchTransition: PrefetchTransition
  ) {
    this.scene = scene;
    this.onRequestTransition = onRequestTransition;
    this.onApplyResolvedTransition = onApplyResolvedTransition;
    this.onTransitionStarted = onTransitionStarted;
    this.onPrefetchTransition = onPrefetchTransition;
  }

  public get isTransitioning(): boolean {
    return this.transitioning;
  }

  public loadZones(map: Phaser.Tilemaps.Tilemap): void {
    this.mapExitZones = [];
    this.prefetchedExitIds.clear();
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
    this.prefetchedExitIds.clear();
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

    this.prefetchNearbyDestination(playerX, playerY);

    const currentExit = this.mapExitZones.find((exitZone) =>
      exitZone.bounds.contains(playerX, playerY)
    );

    if (!currentExit) {
      this.resetExitTracking();
      return;
    }

    const now = this.scene.time.now;

    if (this.activeMapExitId !== currentExit.id) {
      this.activeMapExitId = currentExit.id;

      this.lastMapTransitionRequestAt = now;

      console.log("[MapExit] entered", currentExit.id);

      this.onRequestTransition(currentExit.id);

      return;
    }

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

  private prefetchNearbyDestination(playerX: number, playerY: number): void {
    for (const exitZone of this.mapExitZones) {
      if (this.prefetchedExitIds.has(exitZone.id)) {
        continue;
      }

      const bounds = exitZone.bounds;

      const prefetchBounds = new Phaser.Geom.Rectangle(
        bounds.x - this.prefetchDistancePx,
        bounds.y - this.prefetchDistancePx,
        bounds.width + this.prefetchDistancePx * 2,
        bounds.height + this.prefetchDistancePx * 2
      );

      if (!prefetchBounds.contains(playerX, playerY)) {
        continue;
      }

      this.prefetchedExitIds.add(exitZone.id);

      this.onPrefetchTransition(exitZone.id);
    }
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
      void this.applyResolvedTransition(transition);
    });

    camera.fadeOut(this.fadeDurationMs, 0, 0, 0);
  }

  private async applyResolvedTransition(
    transition: MapTransitionResolved
  ): Promise<void> {
    try {
      await this.onApplyResolvedTransition(transition);
    } catch (error: unknown) {
      console.error("[MapTransition] Failed while changing map", error);
    }

    this.startFadeIn();
  }

  private startFadeIn(): void {
    const camera = this.scene.cameras.main;

    camera.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => {
      this.finishTransition();
    });

    camera.fadeIn(this.fadeDurationMs, 0, 0, 0);
  }
}
