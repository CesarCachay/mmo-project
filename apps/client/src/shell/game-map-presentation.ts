import { MAP_IDS, type MapId } from "@cesar-mmo/shared";

const GAME_MAP_LABELS: Record<MapId, string> = {
  [MAP_IDS.TOWN_01]: "Pueblo 01",
  [MAP_IDS.HOUSE_01]: "Casa",

  [MAP_IDS.ROUTE_01]: "Ruta 01",
  [MAP_IDS.TOWN_02]: "Pueblo 02",
  [MAP_IDS.ROUTE_02]: "Ruta 02",
  [MAP_IDS.CITY_01]: "Ciudad 01",

  [MAP_IDS.GYM_01]: "Gimnasio",
  [MAP_IDS.POKE_CENTER]: "Centro Pokémon",
  [MAP_IDS.POKE_SHOP]: "Tienda Pokémon",
};

export function getGameMapDisplayName(mapId: MapId): string {
  return GAME_MAP_LABELS[mapId];
}
