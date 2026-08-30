export const MAP_IDS = {
  TOWN_01: "town-01",
  HOUSE_01: "house-01",
  ROUTE_01: "route-01",
} as const;

export type MapId = (typeof MAP_IDS)[keyof typeof MAP_IDS];

export const DEFAULT_MAP_ID: MapId = MAP_IDS.TOWN_01;

export const MAP_TRANSITION_ID_MAX_LENGTH = 64;

export type MapTransitionInput = {
  transitionId: string;
};

export const MAP_EVENTS = {
  REQUEST_TRANSITION: "map:transition:request",
  TRANSITION_RESOLVED: "map:transition:resolved",
  PLAYER_LEFT: "map:player:left",
} as const;

export function isMapTransitionInput(value: unknown): value is MapTransitionInput {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  if (!("transitionId" in value)) {
    return false;
  }

  const transitionId = value.transitionId;

  if (typeof transitionId !== "string") {
    return false;
  }

  const normalizedTransitionId = transitionId.trim();

  return (
    normalizedTransitionId.length > 0 &&
    normalizedTransitionId.length <= MAP_TRANSITION_ID_MAX_LENGTH
  );
}

export type MapTransitionResolved = {
  transitionId: string;
  fromMapId: MapId;
  targetMapId: MapId;
  targetSpawn: string;
  x: number;
  y: number;
};
