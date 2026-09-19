import { MAP_IDS } from "./map.js";
import type { MapId } from "./map.js";
import type { Direction } from "./game.types.js";

import { TOWN_01_MAP } from "./maps/generated/town-01.js";
import { HOUSE_01_MAP } from "./maps/generated/house-01.js";
import { ROUTE_01_MAP } from "./maps/generated/route-01.js";
import { TOWN_02_MAP } from "./maps/generated/town-02.js";
import { ROUTE_02_MAP } from "./maps/generated/route-02.js";
import { CITY_01_MAP } from "./maps/generated/city-01.js";
import { GYM_01_MAP } from "./maps/generated/gym-01.js";
import { POKE_CENTER_MAP } from "./maps/generated/poke-center.js";
import { POKE_SHOP_MAP } from "./maps/generated/poke-shop.js";

import { PokemonEncounterTableId } from "./pokemon/encounters/pokemon-encounter-table.registry.js";
import type { PokemonTrainerBattleId } from "./pokemon/trainers/pokemon-trainer-battle.registry.js";

export type SharedMapSpawn = {
  readonly x: number;
  readonly y: number;
};

export type SharedMapNpc = {
  readonly x: number;
  readonly y: number;
  readonly dialogueId?: string;
  readonly trainerBattleId?: PokemonTrainerBattleId;
  readonly direction?: Direction;
  readonly sightRangeTiles?: number;
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

  readonly storageTerminals: Readonly<Record<string, SharedMapStorageTerminal>>;

  readonly healingStations: Readonly<Record<string, SharedMapHealingStation>>;
};

export type SharedMapStorageTerminal = {
  readonly x: number;
  readonly y: number;
};

export type SharedMapHealingStation = {
  readonly x: number;
  readonly y: number;
};

export const MAP_DATA_REGISTRY: Readonly<Record<MapId, SharedMapData>> = {
  [MAP_IDS.TOWN_01]: TOWN_01_MAP,
  [MAP_IDS.HOUSE_01]: HOUSE_01_MAP,

  [MAP_IDS.ROUTE_01]: ROUTE_01_MAP,
  [MAP_IDS.TOWN_02]: TOWN_02_MAP,
  [MAP_IDS.ROUTE_02]: ROUTE_02_MAP,
  [MAP_IDS.CITY_01]: CITY_01_MAP,

  [MAP_IDS.GYM_01]: GYM_01_MAP,
  [MAP_IDS.POKE_CENTER]: POKE_CENTER_MAP,
  [MAP_IDS.POKE_SHOP]: POKE_SHOP_MAP,
} as const;

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
