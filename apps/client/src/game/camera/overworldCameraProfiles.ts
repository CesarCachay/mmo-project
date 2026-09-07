import { MAP_IDS } from "@cesar-mmo/shared";

import type { MapId } from "@cesar-mmo/shared";

export type OverworldCameraProfile = {
  readonly zoom: number;
};

const OUTDOOR_CAMERA_PROFILE: OverworldCameraProfile = {
  zoom: 1,
};

const INTERIOR_CAMERA_PROFILE: OverworldCameraProfile = {
  zoom: 1.25,
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
