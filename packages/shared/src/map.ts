export const MAP_IDS = {
  TOWN_01: "town-01",
} as const;

export type MapId = (typeof MAP_IDS)[keyof typeof MAP_IDS];

export const DEFAULT_MAP_ID: MapId = MAP_IDS.TOWN_01;
