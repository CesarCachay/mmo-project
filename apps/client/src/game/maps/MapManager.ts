import Phaser from "phaser";

import { MAP_REGISTRY } from "./mapRegistry";

import type { MapId } from "@cesar-mmo/shared";

type PlayerSpawn = {
  x: number;
  y: number;
};

export class MapManager {
  private readonly scene: Phaser.Scene;
  private activeMap?: Phaser.Tilemaps.Tilemap;
  private layers: Phaser.Tilemaps.TilemapLayerBase[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public get map(): Phaser.Tilemaps.Tilemap {
    if (!this.activeMap) {
      throw new Error("Map is not currently created");
    }

    return this.activeMap;
  }

  public create(mapId: MapId): void {
    if (this.activeMap) {
      throw new Error(`Cannot create map "${mapId}" while another map is active`);
    }

    const mapConfig = MAP_REGISTRY[mapId];

    if (!this.scene.cache.tilemap.exists(mapConfig.key)) {
      throw new Error(
        `Cannot create map "${mapId}" because its tilemap JSON is not loaded`
      );
    }

    for (const tilesetConfig of mapConfig.tilesets) {
      if (!this.scene.textures.exists(tilesetConfig.key)) {
        throw new Error(
          `Cannot create map "${mapId}" because tileset "${tilesetConfig.key}" is not loaded`
        );
      }
    }

    const map = this.scene.make.tilemap({
      key: mapConfig.key,
    });

    const mapTilesets = mapConfig.tilesets.map((tilesetConfig) => {
      const tiledName = tilesetConfig.tiledName ?? tilesetConfig.key;
      const tileset = map.addTilesetImage(tiledName, tilesetConfig.key);

      if (!tileset) {
        const availableTilesets = map.tilesets
          .map((candidate) => candidate.name)
          .join(", ");

        throw new Error(
          `Could not bind Tiled tileset "${tiledName}" to texture "${tilesetConfig.key}" ` +
            `for map "${mapId}". Tilemap tilesets: ${availableTilesets || "(none)"}`
        );
      }

      return tileset;
    });

    const groundLayer = map.createLayer("Ground", mapTilesets, 0, 0);

    const groundDetailsLayer = map.createLayer("GroundDetails", mapTilesets, 0, 0);

    const buildingsLayer = map.createLayer("Buildings", mapTilesets, 0, 0);

    const abovePlayerLayer = map.createLayer("AbovePlayer", mapTilesets, 0, 0);

    groundLayer?.setDepth(0);
    groundDetailsLayer?.setDepth(1);
    buildingsLayer?.setDepth(2);
    abovePlayerLayer?.setDepth(10);

    if (groundLayer) {
      this.layers.push(groundLayer);
    }

    if (groundDetailsLayer) {
      this.layers.push(groundDetailsLayer);
    }

    if (buildingsLayer) {
      this.layers.push(buildingsLayer);
    }

    if (abovePlayerLayer) {
      this.layers.push(abovePlayerLayer);
    }

    this.activeMap = map;
  }

  public destroy(): void {
    for (const layer of this.layers) {
      layer.destroy();
    }

    this.layers = [];
    this.activeMap = undefined;
  }

  public getPlayerSpawn(): PlayerSpawn {
    const objectsLayer = this.map.getObjectLayer("Objects");

    if (!objectsLayer) {
      throw new Error('Object layer "Objects" not found');
    }

    const playerSpawn = objectsLayer.objects.find(
      (object) => object.name === "playerSpawn"
    );

    if (!playerSpawn || playerSpawn.x === undefined || playerSpawn.y === undefined) {
      throw new Error('Object "playerSpawn" not found');
    }

    return {
      x: playerSpawn.x,
      y: playerSpawn.y,
    };
  }
}
