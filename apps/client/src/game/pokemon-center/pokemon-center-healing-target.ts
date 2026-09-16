import { MAP_DATA_REGISTRY, type MapId } from "@cesar-mmo/shared";

const POKEMON_CENTER_HEALING_INTERACTION_DISTANCE = 36;

export interface PokemonCenterHealingStationTarget {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

export function findNearestPokemonCenterHealingStation(
  mapId: MapId,
  playerX: number,
  playerY: number
): PokemonCenterHealingStationTarget | undefined {
  const healingStations = MAP_DATA_REGISTRY[mapId].healingStations;

  const maxDistanceSquared =
    POKEMON_CENTER_HEALING_INTERACTION_DISTANCE *
    POKEMON_CENTER_HEALING_INTERACTION_DISTANCE;

  let nearest: PokemonCenterHealingStationTarget | undefined;

  let nearestDistanceSquared = maxDistanceSquared;

  for (const [id, station] of Object.entries(healingStations)) {
    const deltaX = playerX - station.x;

    const deltaY = playerY - station.y;

    const distanceSquared = deltaX * deltaX + deltaY * deltaY;

    if (distanceSquared > nearestDistanceSquared) {
      continue;
    }

    nearestDistanceSquared = distanceSquared;

    nearest = {
      id,
      x: station.x,
      y: station.y,
    };
  }

  return nearest;
}
