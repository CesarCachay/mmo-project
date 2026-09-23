import { MAP_IDS, type MapId } from "@cesar-mmo/shared";

const GAME_MAP_LABELS: Record<MapId, string> = {
  [MAP_IDS.TOWN_01]: "Pueblo 01",
  [MAP_IDS.HOUSE_01]: "Casa",

  [MAP_IDS.ROUTE_01]: "Ruta 01",
  [MAP_IDS.TOWN_02]: "Pueblo 02",
  [MAP_IDS.ROUTE_02]: "Ruta 02",
  [MAP_IDS.CITY_01]: "Ciudad 01",
  [MAP_IDS.ROUTE_03]: "Ruta 03",
  [MAP_IDS.CITY_02]: "Ciudad 02",

  [MAP_IDS.GYM_01]: "Gimnasio",
  [MAP_IDS.GYM_02]: "Gimnasio Acuático",
  [MAP_IDS.POKE_CENTER]: "Centro Pokémon",
  [MAP_IDS.POKE_CENTER_02]: "Centro Pokémon · Ciudad 02",
  [MAP_IDS.POKE_SHOP]: "Tienda Pokémon",
  [MAP_IDS.POKE_SHOP_02]: "Tienda Pokémon · Ciudad 02",
};

export function getGameMapDisplayName(mapId: MapId): string {
  return GAME_MAP_LABELS[mapId];
}
