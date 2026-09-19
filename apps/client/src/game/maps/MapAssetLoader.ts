import Phaser from "phaser";

import type { MapId } from "@cesar-mmo/shared";

import { MAP_REGISTRY } from "./mapRegistry";

export class MapAssetLoader {
  private readonly scene: Phaser.Scene;
  private readonly pendingLoads = new Map<MapId, Promise<void>>();
  private loadChain: Promise<void> = Promise.resolve();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Use only from Scene.preload(). Phaser starts that preload batch for us.
   */
  public queueForScenePreload(mapId: MapId): void {
    this.queueMissingAssets(mapId);
  }

  public isMapLoaded(mapId: MapId): boolean {
    const mapConfig = MAP_REGISTRY[mapId];

    if (!this.scene.cache.tilemap.exists(mapConfig.key)) {
      return false;
    }

    return mapConfig.tilesets.every((tileset) => this.scene.textures.exists(tileset.key));
  }

  public ensureMapLoaded(mapId: MapId): Promise<void> {
    if (this.isMapLoaded(mapId)) {
      return Promise.resolve();
    }

    const pending = this.pendingLoads.get(mapId);

    if (pending) {
      return pending;
    }

    const loadPromise = this.loadChain
      .then(() => this.loadMap(mapId))
      .finally(() => {
        this.pendingLoads.delete(mapId);
      });

    /*
     * Keep our own map loads serialized. Runtime loaders from other features
     * are also respected by waitForLoaderIdle() inside loadMap().
     */
    this.loadChain = loadPromise.catch(() => undefined);
    this.pendingLoads.set(mapId, loadPromise);

    return loadPromise;
  }

  /**
   * Fire-and-forget optimization. A later ensureMapLoaded() will reuse the
   * same pending Promise if the player reaches the exit while prefetching.
   */
  public prefetchMap(mapId: MapId): void {
    if (this.isMapLoaded(mapId) || this.pendingLoads.has(mapId)) {
      return;
    }

    void this.ensureMapLoaded(mapId).catch((error: unknown) => {
      console.warn("[MapAssets] destination prefetch failed", {
        mapId,
        error,
      });
    });
  }

  private async loadMap(mapId: MapId): Promise<void> {
    await this.waitForLoaderIdle();

    if (this.isMapLoaded(mapId)) {
      return;
    }

    const queuedFileKeys = this.queueMissingAssets(mapId);

    if (queuedFileKeys.size === 0) {
      if (!this.isMapLoaded(mapId)) {
        throw new Error(
          `Map assets for "${mapId}" are incomplete even though no files were queued`
        );
      }

      return;
    }

    await new Promise<void>((resolve, reject) => {
      const failedFileKeys = new Set<string>();

      const handleFileLoadError = (file: Phaser.Loader.File): void => {
        if (queuedFileKeys.has(file.key)) {
          failedFileKeys.add(file.key);
        }
      };

      const handleComplete = (): void => {
        this.scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, handleFileLoadError);

        if (failedFileKeys.size > 0) {
          reject(
            new Error(
              `Failed to load assets for map "${mapId}": ${[...failedFileKeys].join(
                ", "
              )}`
            )
          );
          return;
        }

        if (!this.isMapLoaded(mapId)) {
          reject(
            new Error(
              `Map "${mapId}" loader completed but required assets are still missing`
            )
          );
          return;
        }

        console.log("[MapAssets] ready", mapId);
        resolve();
      };

      this.scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, handleFileLoadError);

      this.scene.load.once(Phaser.Loader.Events.COMPLETE, handleComplete);

      this.scene.load.start();
    });
  }

  private queueMissingAssets(mapId: MapId): Set<string> {
    const mapConfig = MAP_REGISTRY[mapId];
    const queuedFileKeys = new Set<string>();

    if (!this.scene.cache.tilemap.exists(mapConfig.key)) {
      this.scene.load.tilemapTiledJSON(mapConfig.key, mapConfig.path);
      queuedFileKeys.add(mapConfig.key);
    }

    for (const tileset of mapConfig.tilesets) {
      if (this.scene.textures.exists(tileset.key)) {
        continue;
      }

      this.scene.load.image(tileset.key, tileset.path);
      queuedFileKeys.add(tileset.key);
    }

    return queuedFileKeys;
  }

  private waitForLoaderIdle(): Promise<void> {
    if (!this.scene.load.isLoading()) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
    });
  }
}
