import { MAP_IDS } from "@cesar-mmo/shared";

import type { MapId } from "@cesar-mmo/shared";

export type OverworldCameraProfile = {
  /** Desktop / 16:9 baseline zoom. */
  readonly zoom: number;

  /**
   * Lower zoom bound used only on touch-first landscape viewports wider than 16:9.
   *
   * Scale.EXPAND can expose a very wide but short viewport on phones. Reducing the
   * zoom for those aspect ratios keeps enough vertical world space visible without
   * changing the desktop framing.
   */
  readonly touchLandscapeMinZoom: number;

  /**
   * Upper bound for touch-landscape framing. Mobile is allowed to get slightly
   * closer than the desktop baseline when that helps eliminate empty gutters.
   */
  readonly touchLandscapeMaxZoom: number;

  /**
   * Maximum relative zoom increase allowed when the current map is narrower than
   * the responsive camera viewport. This reduces visible side gutters without
   * sacrificing the vertical framing gains from the responsive zoom.
   *
   * Example: 0.12 allows at most a 12% increase over the responsive zoom.
   */
  readonly touchLandscapeMaxMapFillAdjustment: number;
};

const OUTDOOR_CAMERA_PROFILE: OverworldCameraProfile = {
  zoom: 1.5,
  touchLandscapeMinZoom: 1.2,
  touchLandscapeMaxZoom: 1.58,
  touchLandscapeMaxMapFillAdjustment: 0.35,
};

const INTERIOR_CAMERA_PROFILE: OverworldCameraProfile = {
  zoom: 1.75,
  touchLandscapeMinZoom: 1.4,
  touchLandscapeMaxZoom: 1.84,
  touchLandscapeMaxMapFillAdjustment: 0.30,
};

export const OVERWORLD_CAMERA_PROFILES: Record<MapId, OverworldCameraProfile> = {
  [MAP_IDS.TOWN_01]: OUTDOOR_CAMERA_PROFILE,

  [MAP_IDS.ROUTE_01]: OUTDOOR_CAMERA_PROFILE,

  [MAP_IDS.TOWN_02]: OUTDOOR_CAMERA_PROFILE,

  [MAP_IDS.ROUTE_02]: OUTDOOR_CAMERA_PROFILE,

  [MAP_IDS.CITY_01]: OUTDOOR_CAMERA_PROFILE,

  [MAP_IDS.HOUSE_01]: INTERIOR_CAMERA_PROFILE,

  [MAP_IDS.GYM_01]: INTERIOR_CAMERA_PROFILE,

  [MAP_IDS.POKE_CENTER]: INTERIOR_CAMERA_PROFILE,

  [MAP_IDS.POKE_SHOP]: INTERIOR_CAMERA_PROFILE,
};

export function getOverworldCameraProfile(mapId: MapId): OverworldCameraProfile {
  return OVERWORLD_CAMERA_PROFILES[mapId];
}
