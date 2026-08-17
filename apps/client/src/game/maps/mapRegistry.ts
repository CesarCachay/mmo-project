import { MAP_IDS } from "@cesar-mmo/shared";
import type { MapId } from "@cesar-mmo/shared";

export type GameMapTilesetConfig = {
  key: string;
  path: string;
};

export type GameMapConfig = {
  id: MapId;
  key: string;
  path: string;
  tilesets: GameMapTilesetConfig[];
};

export const MAP_REGISTRY: Record<MapId, GameMapConfig> = {
  [MAP_IDS.TOWN_01]: {
    id: MAP_IDS.TOWN_01,
    key: MAP_IDS.TOWN_01,
    path: "/assets/maps/town-01/town-01.json",
    tilesets: [
      {
        key: "town-terrain",
        path: "/assets/maps/town-01/poke-sheet.png",
      },
      {
        key: "town-buildings",
        path: "/assets/maps/town-01/poke-assets.png",
      },
    ],
  },
};
