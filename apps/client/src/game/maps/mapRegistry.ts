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

  [MAP_IDS.ROUTE_01]: {
    id: MAP_IDS.ROUTE_01,
    key: MAP_IDS.ROUTE_01,
    path: "/assets/maps/route-01/route-01.json",
    tilesets: [
      {
        key: "route-01-terrain",
        path: "/assets/maps/tilesets/route/route-01-terrain.png",
      },
      {
        key: "route-01-collision",
        path: "/assets/maps/tilesets/route/route-01-collision-marker.png",
      },
    ],
  },

  [MAP_IDS.TOWN_02]: {
    id: MAP_IDS.TOWN_02,
    key: MAP_IDS.TOWN_02,
    path: "/assets/maps/town-02/town-02.json",
    tilesets: [
      {
        key: "town-02-terrain",
        path: "/assets/maps/tilesets/town-02/town-02-terrain.png",
      },
      {
        key: "town-02-collision",
        path: "/assets/maps/tilesets/town-02/town-02-collision-marker.png",
      },
    ],
  },

  [MAP_IDS.ROUTE_02]: {
    id: MAP_IDS.ROUTE_02,
    key: MAP_IDS.ROUTE_02,
    path: "/assets/maps/route-02/route-02.json",
    tilesets: [
      {
        key: "route-02-terrain",
        path: "/assets/maps/tilesets/route-02/route-02-terrain.png",
      },
      {
        key: "route-02-collision",
        path: "/assets/maps/tilesets/route-02/route-02-collision-marker.png",
      },
    ],
  },

  [MAP_IDS.CITY_01]: {
    id: MAP_IDS.CITY_01,
    key: MAP_IDS.CITY_01,
    path: "/assets/maps/city-01/city-01.json",
    tilesets: [
      {
        key: "city-ds-terrain-v1",
        path: "/assets/maps/tilesets/production/city-ds-v1/city-ds-terrain-v1.png",
      },
      {
        key: "city-01-stamps-v2",
        path: "/assets/maps/tilesets/city-01-v2/city-01-stamps-v2.png",
      },
      {
        key: "production-collision",
        path: "/assets/maps/tilesets/production/production-collision-marker.png",
      },
    ],
  },

  [MAP_IDS.ROUTE_03]: {
    id: MAP_IDS.ROUTE_03,
    key: MAP_IDS.ROUTE_03,
    path: "/assets/maps/route-03/route-03.json",
    tilesets: [
      {
        key: "city-ds-terrain-v1",
        path: "/assets/maps/tilesets/production/city-ds-v1/city-ds-terrain-v1.png",
      },
      {
        key: "route-03-stamps-v1",
        path: "/assets/maps/tilesets/route-03/route-03-stamps-v1.png",
      },
      {
        key: "production-collision",
        path: "/assets/maps/tilesets/production/production-collision-marker.png",
      },
    ],
  },

  [MAP_IDS.CITY_02]: {
    id: MAP_IDS.CITY_02,
    key: MAP_IDS.CITY_02,
    path: "/assets/maps/city-02/city-02.json",
    tilesets: [
      {
        key: "city-02",
        path: "/assets/maps/tilesets/city-02/city-02.png",
      },
      {
        key: "production-collision",
        path: "/assets/maps/tilesets/production/production-collision-marker.png",
      },
    ],
  },

  [MAP_IDS.GYM_01]: {
    id: MAP_IDS.GYM_01,
    key: MAP_IDS.GYM_01,
    path: "/assets/maps/gym-01/gym-01.json",
    tilesets: [
      {
        key: "gym-01-terrain",
        path: "/assets/maps/tilesets/gym-01/gym-01-terrain.png",
      },
      {
        key: "gym-01-collision",
        path: "/assets/maps/tilesets/gym-01/gym-01-collision-marker.png",
      },
    ],
  },

  [MAP_IDS.GYM_02]: {
    id: MAP_IDS.GYM_02,
    key: MAP_IDS.GYM_02,
    path: "/assets/maps/gym-02/gym-02.json",
    tilesets: [
      {
        key: "gym-02",
        path: "/assets/maps/tilesets/gym-02/gym-02.png",
      },
      {
        key: "production-collision",
        path: "/assets/maps/tilesets/production/production-collision-marker.png",
      },
    ],
  },

  [MAP_IDS.POKE_CENTER]: {
    id: MAP_IDS.POKE_CENTER,
    key: MAP_IDS.POKE_CENTER,
    path: "/assets/maps/poke-center/poke-center.json",
    tilesets: [
      {
        key: "poke-center-terrain",
        path: "/assets/maps/tilesets/poke-center/poke-center-terrain.png",
      },
      {
        key: "poke-center-collision",
        path: "/assets/maps/tilesets/poke-center/poke-center-collision-marker.png",
      },
    ],
  },

  [MAP_IDS.POKE_CENTER_02]: {
    id: MAP_IDS.POKE_CENTER_02,
    key: MAP_IDS.POKE_CENTER_02,
    path: "/assets/maps/poke-center-02/poke-center-02.json",
    tilesets: [
      {
        key: "poke-center-terrain",
        path: "/assets/maps/tilesets/poke-center/poke-center-terrain.png",
      },
      {
        key: "poke-center-collision",
        path: "/assets/maps/tilesets/poke-center/poke-center-collision-marker.png",
      },
    ],
  },

  [MAP_IDS.POKE_SHOP]: {
    id: MAP_IDS.POKE_SHOP,
    key: MAP_IDS.POKE_SHOP,
    path: "/assets/maps/poke-shop/poke-shop.json",
    tilesets: [
      {
        key: "poke-shop-terrain-v2",
        path: "/assets/maps/tilesets/poke-shop/poke-shop-terrain-v2.png",
      },
      {
        key: "poke-shop-collision",
        path: "/assets/maps/tilesets/poke-shop/poke-shop-collision-marker.png",
      },
    ],
  },

  [MAP_IDS.POKE_SHOP_02]: {
    id: MAP_IDS.POKE_SHOP_02,
    key: MAP_IDS.POKE_SHOP_02,
    path: "/assets/maps/poke-shop-02/poke-shop-02.json",
    tilesets: [
      {
        key: "poke-shop-terrain-v2",
        path: "/assets/maps/tilesets/poke-shop/poke-shop-terrain-v2.png",
      },
      {
        key: "poke-shop-collision",
        path: "/assets/maps/tilesets/poke-shop/poke-shop-collision-marker.png",
      },
    ],
  },
};
