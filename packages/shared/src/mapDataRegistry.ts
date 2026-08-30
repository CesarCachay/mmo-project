import { MAP_IDS } from "./map.js";
import type { MapId } from "./map.js";

import { TOWN_01_MAP } from "./maps/generated/town-01.js";
import { HOUSE_01_MAP } from "./maps/generated/house-01.js";
import { ROUTE_01_MAP } from "./maps/generated/route-01.js";

import { PokemonEncounterTableId } from "./pokemon/encounters/pokemon-encounter-table.registry.js";

export type SharedMapSpawn = {
  readonly x: number;
  readonly y: number;
};

export type SharedMapNpc = {
  readonly x: number;
  readonly y: number;
  readonly dialogueId?: string;
  readonly postDialogueAction?: string;
};

export type SharedMapTransitionTrigger = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type SharedMapTransition = {
  readonly targetMapId: MapId;
  readonly targetSpawn: string;
  readonly trigger: SharedMapTransitionTrigger;
};

export type SharedMapData = {
  readonly id: MapId;

  readonly width: number;
  readonly height: number;

  readonly tileWidth: number;
  readonly tileHeight: number;

  readonly widthInPixels: number;
  readonly heightInPixels: number;

  readonly spawn: {
    readonly x: number;
    readonly y: number;
  };

  readonly collision: readonly number[];
  readonly spawns: Readonly<Record<string, SharedMapSpawn>>;
  readonly transitions: Readonly<Record<string, SharedMapTransition>>;

  readonly npcs?: Readonly<Record<string, SharedMapNpc>>;

  readonly encounterZones: Readonly<Record<string, SharedMapEncounterZone>>;
};

export const MAP_DATA_REGISTRY: Record<MapId, SharedMapData> = {
  [MAP_IDS.TOWN_01]: TOWN_01_MAP,
  [MAP_IDS.HOUSE_01]: HOUSE_01_MAP,
  [MAP_IDS.ROUTE_01]: ROUTE_01_MAP,
};

export type SharedMapEncounterZoneBounds = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type SharedMapEncounterZone = {
  readonly encounterTableId: PokemonEncounterTableId;
  readonly bounds: SharedMapEncounterZoneBounds;
};
