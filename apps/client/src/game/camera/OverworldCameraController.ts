import Phaser from "phaser";
import type { Direction, MapId } from "@cesar-mmo/shared";
import { getOverworldCameraProfile } from "./overworldCameraProfiles";

const CAMERA_FOLLOW_LERP_X = 0.18;
const CAMERA_FOLLOW_LERP_Y = 0.18;

const CAMERA_DEADZONE_WIDTH = 32;
const CAMERA_DEADZONE_HEIGHT = 24;

const CAMERA_LOOK_AHEAD_X = 24;
const CAMERA_LOOK_AHEAD_Y = 16;

const CAMERA_LOOK_AHEAD_RATE = 7;

const TOUCH_PRIMARY_QUERY = "(hover: none) and (pointer: coarse)";
const TOUCH_CAMERA_ZOOM_MULTIPLIER = 1.12;
const CAMERA_ZOOM_EPSILON = 0.001;

export class OverworldCameraController {
  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  private readonly player: Phaser.GameObjects.Sprite;
  private readonly scale: Phaser.Scale.ScaleManager;

  private activeMapId?: MapId;
  private activeMap?: Phaser.Tilemaps.Tilemap;
  private readonly touchPrimaryMedia = window.matchMedia(TOUCH_PRIMARY_QUERY);
  private appliedZoom = 0;

  private followOffsetX = 0;
  private followOffsetY = 0;

  constructor(
    camera: Phaser.Cameras.Scene2D.Camera,
    player: Phaser.GameObjects.Sprite,
    scale: Phaser.Scale.ScaleManager
  ) {
    this.camera = camera;
    this.player = player;
    this.scale = scale;

    this.scale.on("resize", this.handleScaleResize, this);
  }

  public start(mapId: MapId, map: Phaser.Tilemaps.Tilemap): void {
    this.activeMapId = mapId;
    this.activeMap = map;

    this.followOffsetX = 0;
    this.followOffsetY = 0;

    this.applyMap(mapId, map);

    this.camera.startFollow(
      this.player,
      true,
      CAMERA_FOLLOW_LERP_X,
      CAMERA_FOLLOW_LERP_Y
    );

    this.camera.setDeadzone(CAMERA_DEADZONE_WIDTH, CAMERA_DEADZONE_HEIGHT);

    this.camera.setFollowOffset(0, 0);

    this.camera.centerOn(this.player.x, this.player.y);
  }

  public update(delta: number, direction: Direction, isMoving: boolean): void {
    this.refreshResponsiveZoom();
    const targetOffset = this.getTargetFollowOffset(direction, isMoving);

    const alpha = 1 - Math.exp(-CAMERA_LOOK_AHEAD_RATE * (delta / 1000));

    this.followOffsetX = Phaser.Math.Linear(this.followOffsetX, targetOffset.x, alpha);
    this.followOffsetY = Phaser.Math.Linear(this.followOffsetY, targetOffset.y, alpha);

    this.camera.setFollowOffset(this.followOffsetX, this.followOffsetY);
  }

  public updateBounds(map: Phaser.Tilemaps.Tilemap): void {
    const mapWidth = map.widthInPixels;
    const mapHeight = map.heightInPixels;

    const viewportWidth = this.camera.width / this.camera.zoom;
    const viewportHeight = this.camera.height / this.camera.zoom;

    const horizontalPadding = Math.max(0, (viewportWidth - mapWidth) / 2);
    const verticalPadding = Math.max(0, (viewportHeight - mapHeight) / 2);

    this.camera.setBounds(
      -horizontalPadding,
      -verticalPadding,
      mapWidth + horizontalPadding * 2,
      mapHeight + verticalPadding * 2
    );
  }

  private getTargetFollowOffset(
    direction: Direction,
    isMoving: boolean
  ): {
    x: number;
    y: number;
  } {
    if (!isMoving) {
      return {
        x: 0,
        y: 0,
      };
    }

    switch (direction) {
      case "left":
        return {
          x: CAMERA_LOOK_AHEAD_X,
          y: 0,
        };

      case "right":
        return {
          x: -CAMERA_LOOK_AHEAD_X,
          y: 0,
        };

      case "up":
        return {
          x: 0,
          y: CAMERA_LOOK_AHEAD_Y,
        };

      case "down":
        return {
          x: 0,
          y: -CAMERA_LOOK_AHEAD_Y,
        };
    }
  }

  public applyMap(mapId: MapId, map: Phaser.Tilemaps.Tilemap): void {
    this.activeMapId = mapId;
    this.activeMap = map;

    const zoom = this.resolveZoom(mapId);

    const zoomChanged = Math.abs(this.appliedZoom - zoom) >= CAMERA_ZOOM_EPSILON;

    if (zoomChanged) {
      this.appliedZoom = zoom;
      this.camera.setZoom(zoom);
    }

    this.updateBounds(map);
  }

  public resetForMap(mapId: MapId, map: Phaser.Tilemaps.Tilemap): void {
    this.activeMapId = mapId;
    this.activeMap = map;

    this.followOffsetX = 0;
    this.followOffsetY = 0;

    this.camera.setFollowOffset(0, 0);

    this.applyMap(mapId, map);

    this.camera.centerOn(this.player.x, this.player.y);
  }

  private resolveZoom(mapId: MapId): number {
    const profile = getOverworldCameraProfile(mapId);

    if (!this.touchPrimaryMedia.matches) {
      return profile.zoom;
    }

    return profile.zoom * TOUCH_CAMERA_ZOOM_MULTIPLIER;
  }

  private refreshResponsiveZoom(): void {
    const mapId = this.activeMapId;
    const map = this.activeMap;

    if (!mapId || !map) {
      return;
    }

    const zoom = this.resolveZoom(mapId);
    const zoomChanged = Math.abs(this.appliedZoom - zoom) >= CAMERA_ZOOM_EPSILON;

    if (!zoomChanged) {
      return;
    }

    this.appliedZoom = zoom;
    this.camera.setZoom(zoom);

    /* Aquí sí recalculamos bounds únicamente cuando cambia el zoom responsive */
    this.updateBounds(map);
  }

  public destroy(): void {
    this.scale.off("resize", this.handleScaleResize, this);
  }

  private handleScaleResize(): void {
    const mapId = this.activeMapId;
    const map = this.activeMap;

    if (!mapId || !map) {
      return;
    }

    const zoom = this.resolveZoom(mapId);

    const zoomChanged = Math.abs(this.appliedZoom - zoom) >= CAMERA_ZOOM_EPSILON;

    if (zoomChanged) {
      this.appliedZoom = zoom;
      this.camera.setZoom(zoom);
    }

    this.updateBounds(map);

    this.followOffsetX = 0;
    this.followOffsetY = 0;

    this.camera.setFollowOffset(0, 0);

    this.camera.centerOn(this.player.x, this.player.y);
  }
}
