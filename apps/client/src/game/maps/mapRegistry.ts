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
        path: "/assets/maps/tilesets/town/town-terrain.png",
      },
      {
        key: "town-buildings",
        path: "/assets/maps/tilesets/town/town-building.png",
      },
    ],
  },
  [MAP_IDS.HOUSE_01]: {
    id: MAP_IDS.HOUSE_01,
    key: MAP_IDS.HOUSE_01,
    path: "/assets/maps/house-01/house-01.json",

    tilesets: [
      {
        key: "interior-floors-walls",
        path: "/assets/maps/tilesets/interiors/bitglow-lrk/interior-floors-walls.png",
      },
      {
        key: "interior-cabinets",
        path: "/assets/maps/tilesets/interiors/bitglow-lrk/interior-cabinets.png",
      },
      {
        key: "interior-decorations",
        path: "/assets/maps/tilesets/interiors/bitglow-lrk/interior-decorations.png",
      },
      {
        key: "interior-living-room",
        path: "/assets/maps/tilesets/interiors/bitglow-lrk/interior-living-room.png",
      },
    ],
  },
};
