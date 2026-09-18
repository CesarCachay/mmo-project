import Phaser from "phaser";
import type { Direction, MapId } from "@cesar-mmo/shared";
import { getOverworldCameraProfile } from "./overworldCameraProfiles";

const CAMERA_FOLLOW_LERP_X = 0.18;
const CAMERA_FOLLOW_LERP_Y = 0.18;

const CAMERA_DEADZONE_WIDTH = 32;
const CAMERA_DEADZONE_HEIGHT = 24;

const CAMERA_LOOK_AHEAD_X = 24;
const CAMERA_LOOK_AHEAD_Y = 16;
const TOUCH_LANDSCAPE_LOOK_AHEAD_X_SCALE = 0.5;
const TOUCH_LANDSCAPE_LOOK_AHEAD_Y_SCALE = 0;

const CAMERA_LOOK_AHEAD_RATE = 7;

const TOUCH_PRIMARY_QUERY = "(hover: none) and (pointer: coarse)";
const REFERENCE_LANDSCAPE_ASPECT = 16 / 9;
const CAMERA_ZOOM_EPSILON = 0.001;

/*
 * Keep touch-landscape framing tighter than desktop. Phaser's native camera
 * deadzone remains the single follow authority; we do not manually fight
 * startFollow() by mutating camera scroll every frame.
 */
const TOUCH_SAFE_DEADZONE_WIDTH_RATIO = 0.04;
const TOUCH_SAFE_DEADZONE_HEIGHT_RATIO = 0.05;
const TOUCH_SAFE_DEADZONE_MIN_WIDTH = 20;
const TOUCH_SAFE_DEADZONE_MAX_WIDTH = 32;
const TOUCH_SAFE_DEADZONE_MIN_HEIGHT = 16;
const TOUCH_SAFE_DEADZONE_MAX_HEIGHT = 24;

/*
 * Camera edge overscan is expressed in SCREEN pixels so the UX remains stable
 * across zoom levels. It is converted to world units when bounds are applied.
 *
 * Bottom gets a larger budget because mobile browser/home-indicator chrome and
 * thumb controls make that edge more likely to hide the player visually.
 */
const TOUCH_EDGE_TOP_SCREEN_RATIO = 0.06;
const TOUCH_EDGE_TOP_SCREEN_MIN = 20;
const TOUCH_EDGE_TOP_SCREEN_MAX = 32;

const TOUCH_EDGE_BOTTOM_SCREEN_RATIO = 0.12;
const TOUCH_EDGE_BOTTOM_SCREEN_MIN = 40;
const TOUCH_EDGE_BOTTOM_SCREEN_MAX = 64;

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

    this.applySafePlayerFraming();
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
    const centeredVerticalPadding = Math.max(0, (viewportHeight - mapHeight) / 2);

    let topEdgePadding = 0;
    let bottomEdgePadding = 0;

    if (this.isTouchLandscapeViewport()) {
      const topScreenPadding = Phaser.Math.Clamp(
        this.camera.height * TOUCH_EDGE_TOP_SCREEN_RATIO,
        TOUCH_EDGE_TOP_SCREEN_MIN,
        TOUCH_EDGE_TOP_SCREEN_MAX
      );

      const bottomScreenPadding = Phaser.Math.Clamp(
        this.camera.height * TOUCH_EDGE_BOTTOM_SCREEN_RATIO,
        TOUCH_EDGE_BOTTOM_SCREEN_MIN,
        TOUCH_EDGE_BOTTOM_SCREEN_MAX
      );

      /*
       * Camera bounds use world units. Divide screen-space safety budgets by the
       * current zoom so the visible margin stays approximately constant on-screen.
       */
      topEdgePadding = topScreenPadding / this.camera.zoom;
      bottomEdgePadding = bottomScreenPadding / this.camera.zoom;
    }

    const topPadding = centeredVerticalPadding + topEdgePadding;
    const bottomPadding = centeredVerticalPadding + bottomEdgePadding;

    this.camera.setBounds(
      -horizontalPadding,
      -topPadding,
      mapWidth + horizontalPadding * 2,
      mapHeight + topPadding + bottomPadding
    );
  }

  public applyMap(mapId: MapId, map: Phaser.Tilemaps.Tilemap): void {
    this.activeMapId = mapId;
    this.activeMap = map;

    const zoom = this.resolveZoom(mapId, map);
    const zoomChanged = Math.abs(this.appliedZoom - zoom) >= CAMERA_ZOOM_EPSILON;

    if (zoomChanged) {
      this.appliedZoom = zoom;
      this.camera.setZoom(zoom);
    }

    /*
     * Always recompute bounds for the current map, even if the zoom profile did
     * not change. This is required for same-profile transitions and EXPAND resize.
     */
    this.updateBounds(map);
  }

  public resetForMap(mapId: MapId, map: Phaser.Tilemaps.Tilemap): void {
    this.activeMapId = mapId;
    this.activeMap = map;

    this.followOffsetX = 0;
    this.followOffsetY = 0;

    this.camera.setFollowOffset(0, 0);

    this.applyMap(mapId, map);

    this.applySafePlayerFraming();
    this.camera.centerOn(this.player.x, this.player.y);
  }

  public destroy(): void {
    this.scale.off("resize", this.handleScaleResize, this);
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

    const touchLandscape = this.isTouchLandscapeViewport();

    const lookAheadX =
      CAMERA_LOOK_AHEAD_X * (touchLandscape ? TOUCH_LANDSCAPE_LOOK_AHEAD_X_SCALE : 1);

    /*
     * Keep vertical look-ahead disabled on touch landscape. Vertical screen space
     * is the scarce axis on phones, so centering the player is more valuable than
     * looking ahead a few pixels while walking up/down.
     */
    const lookAheadY =
      CAMERA_LOOK_AHEAD_Y * (touchLandscape ? TOUCH_LANDSCAPE_LOOK_AHEAD_Y_SCALE : 1);

    switch (direction) {
      case "left":
        return {
          x: lookAheadX,
          y: 0,
        };

      case "right":
        return {
          x: -lookAheadX,
          y: 0,
        };

      case "up":
        return {
          x: 0,
          y: lookAheadY,
        };

      case "down":
        return {
          x: 0,
          y: -lookAheadY,
        };
    }
  }

  private resolveZoom(mapId: MapId, map: Phaser.Tilemaps.Tilemap): number {
    const profile = getOverworldCameraProfile(mapId);

    if (!this.isTouchLandscapeViewport()) {
      return profile.zoom;
    }

    const viewportHeight = Math.max(1, this.camera.height);
    const viewportAspect = this.camera.width / viewportHeight;

    /*
     * 16:9 touch landscapes keep the normal map profile. Wider phone viewports
     * progressively zoom out so their reduced vertical space does not crop as
     * much of the world. The map profile supplies the floor, keeping sprites and
     * interiors from becoming too small on extreme aspect ratios.
     */
    const aspectScale = Math.min(
      1,
      REFERENCE_LANDSCAPE_ASPECT / Math.max(REFERENCE_LANDSCAPE_ASPECT, viewportAspect)
    );

    const responsiveZoom = Phaser.Math.Clamp(
      profile.zoom * aspectScale,
      profile.touchLandscapeMinZoom,
      profile.zoom
    );

    /*
     * Camera Responsive V2.1 — Map Fill Constraint
     *
     * A very wide Scale.EXPAND viewport can become wider than the rendered map
     * after responsive zoom-out. Raising the zoom just enough to cover the full
     * width would remove gutters, but on narrow maps that can undo the vertical
     * visibility improvement that V2 introduced.
     *
     * Therefore the map may influence the zoom, but only inside a small,
     * profile-controlled budget. This reduces side gutters while keeping player
     * visibility and vertical framing as the higher priority.
     */
    const mapWidth = Math.max(1, map.widthInPixels);
    const widthCoverZoom = this.camera.width / mapWidth;

    const maximumMapFillZoom = Math.min(
      profile.zoom,
      responsiveZoom * (1 + profile.touchLandscapeMaxMapFillAdjustment)
    );

    const mapAwareZoom = Math.min(widthCoverZoom, maximumMapFillZoom);

    return Phaser.Math.Clamp(
      Math.max(responsiveZoom, mapAwareZoom),
      profile.touchLandscapeMinZoom,
      profile.zoom
    );
  }

  private refreshResponsiveZoom(): void {
    const mapId = this.activeMapId;
    const map = this.activeMap;

    if (!mapId || !map) {
      return;
    }

    const zoom = this.resolveZoom(mapId, map);
    const zoomChanged = Math.abs(this.appliedZoom - zoom) >= CAMERA_ZOOM_EPSILON;

    if (!zoomChanged) {
      return;
    }

    this.appliedZoom = zoom;
    this.camera.setZoom(zoom);

    this.updateBounds(map);
    this.applySafePlayerFraming();
  }

  private isTouchLandscapeViewport(): boolean {
    return this.touchPrimaryMedia.matches && this.camera.width > this.camera.height;
  }

  private applySafePlayerFraming(): void {
    if (!this.isTouchLandscapeViewport()) {
      this.camera.setDeadzone(CAMERA_DEADZONE_WIDTH, CAMERA_DEADZONE_HEIGHT);
      return;
    }

    const deadzoneWidth = Phaser.Math.Clamp(
      this.camera.width * TOUCH_SAFE_DEADZONE_WIDTH_RATIO,
      TOUCH_SAFE_DEADZONE_MIN_WIDTH,
      TOUCH_SAFE_DEADZONE_MAX_WIDTH
    );

    const deadzoneHeight = Phaser.Math.Clamp(
      this.camera.height * TOUCH_SAFE_DEADZONE_HEIGHT_RATIO,
      TOUCH_SAFE_DEADZONE_MIN_HEIGHT,
      TOUCH_SAFE_DEADZONE_MAX_HEIGHT
    );

    this.camera.setDeadzone(deadzoneWidth, deadzoneHeight);
  }

  private handleScaleResize(): void {
    const mapId = this.activeMapId;
    const map = this.activeMap;

    if (!mapId || !map) {
      return;
    }

    const zoom = this.resolveZoom(mapId, map);
    const zoomChanged = Math.abs(this.appliedZoom - zoom) >= CAMERA_ZOOM_EPSILON;

    if (zoomChanged) {
      this.appliedZoom = zoom;
      this.camera.setZoom(zoom);
    }

    /*
     * Scale.EXPAND can change camera.width / camera.height without changing map
     * or profile, so bounds must be recomputed on every resize.
     */
    this.updateBounds(map);

    this.followOffsetX = 0;
    this.followOffsetY = 0;

    this.camera.setFollowOffset(0, 0);
    this.applySafePlayerFraming();
    this.camera.centerOn(this.player.x, this.player.y);
  }
}
