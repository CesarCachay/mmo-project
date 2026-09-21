import {
  MAP_DATA_REGISTRY,
  POKEMON_TRAINER_SIGHT_INTERACTION_LATERAL_TOLERANCE_FACTOR,
  checkPokemonTrainerSight,
} from '@cesar-mmo/shared';

import type {
  MapId,
  SharedMapSpawn,
  SharedMapTransition,
  SharedMapNpc,
  SharedMapEncounterZone,
  SharedMapStorageTerminal,
  SharedMapHealingStation,
} from '@cesar-mmo/shared';

const MAP_TRANSITION_TRIGGER_TOLERANCE = 8;

const NPC_INTERACTION_DISTANCE = 36;

const NPC_INTERACTION_SERVER_TOLERANCE = 4;


const MAX_NPC_INTERACTION_DISTANCE =
  NPC_INTERACTION_DISTANCE + NPC_INTERACTION_SERVER_TOLERANCE;

const STORAGE_TERMINAL_INTERACTION_DISTANCE = 36;

const STORAGE_TERMINAL_SERVER_TOLERANCE = 4;

const MAX_STORAGE_TERMINAL_INTERACTION_DISTANCE =
  STORAGE_TERMINAL_INTERACTION_DISTANCE + STORAGE_TERMINAL_SERVER_TOLERANCE;

const HEALING_STATION_INTERACTION_DISTANCE = 36;

const HEALING_STATION_SERVER_TOLERANCE = 4;

const MAX_HEALING_STATION_INTERACTION_DISTANCE =
  HEALING_STATION_INTERACTION_DISTANCE + HEALING_STATION_SERVER_TOLERANCE;

export type ServerMapEncounterZone = SharedMapEncounterZone & {
  readonly id: string;
};

type ServerMapTransitionRegistry = Readonly<
  Record<string, SharedMapTransition>
>;
type ServerMapSpawnRegistry = Readonly<Record<string, SharedMapSpawn>>;
type ServerMapNpcRegistry = Readonly<Record<string, SharedMapNpc>>;
type ServerMapStorageTerminalRegistry = Readonly<
  Record<string, SharedMapStorageTerminal>
>;
type ServerMapHealingStationRegistry = Readonly<
  Record<string, SharedMapHealingStation>
>;

export function getServerMapTransition(
  mapId: MapId,
  transitionId: string,
): SharedMapTransition | undefined {
  const transitions = MAP_DATA_REGISTRY[mapId]
    .transitions as ServerMapTransitionRegistry;

  return transitions[transitionId.trim()];
}

export function getServerMapSpawn(
  mapId: MapId,
  spawnId: string,
): SharedMapSpawn | undefined {
  const spawns = MAP_DATA_REGISTRY[mapId].spawns as ServerMapSpawnRegistry;

  return spawns[spawnId.trim()];
}

export function isPlayerInsideMapTransition(
  playerX: number,
  playerY: number,
  transition: SharedMapTransition,
): boolean {
  const { trigger } = transition;

  const minX = trigger.x - MAP_TRANSITION_TRIGGER_TOLERANCE;
  const maxX = trigger.x + trigger.width + MAP_TRANSITION_TRIGGER_TOLERANCE;
  const minY = trigger.y - MAP_TRANSITION_TRIGGER_TOLERANCE;
  const maxY = trigger.y + trigger.height + MAP_TRANSITION_TRIGGER_TOLERANCE;

  return (
    playerX >= minX && playerX <= maxX && playerY >= minY && playerY <= maxY
  );
}

export function getServerMapNpc(
  mapId: MapId,
  npcId: string,
): SharedMapNpc | undefined {
  const npcs = MAP_DATA_REGISTRY[mapId].npcs as ServerMapNpcRegistry;

  if (!npcs) {
    return undefined;
  }

  return npcs[npcId.trim()];
}

export function isPlayerNearMapNpc(
  playerX: number,
  playerY: number,
  npc: SharedMapNpc,
): boolean {
  const deltaX = playerX - npc.x;
  const deltaY = playerY - npc.y;
  const distanceSquared = deltaX * deltaX + deltaY * deltaY;

  const maxDistanceSquared =
    MAX_NPC_INTERACTION_DISTANCE * MAX_NPC_INTERACTION_DISTANCE;

  return distanceSquared <= maxDistanceSquared;
}

export function isPlayerInsideTrainerNpcSight(
  mapId: MapId,
  playerX: number,
  playerY: number,
  npc: SharedMapNpc,
): boolean {
  if (!npc.trainerBattleId || !npc.direction || !npc.sightRangeTiles) {
    return false;
  }

  return checkPokemonTrainerSight({
    trainer: {
      position: { x: npc.x, y: npc.y },
      direction: npc.direction,
      sightRangeTiles: npc.sightRangeTiles,
    },
    target: { x: playerX, y: playerY },
    map: MAP_DATA_REGISTRY[mapId],
  }).detected;
}

export function isPlayerInsideTrainerNpcSightForInteraction(
  mapId: MapId,
  playerX: number,
  playerY: number,
  npc: SharedMapNpc,
): boolean {
  if (!npc.trainerBattleId || !npc.direction || !npc.sightRangeTiles) {
    return false;
  }

  const map = MAP_DATA_REGISTRY[mapId];
  const horizontal = npc.direction === 'left' || npc.direction === 'right';
  const laneSize = horizontal ? map.tileHeight : map.tileWidth;

  return checkPokemonTrainerSight({
    trainer: {
      position: { x: npc.x, y: npc.y },
      direction: npc.direction,
      sightRangeTiles: npc.sightRangeTiles,
    },
    target: { x: playerX, y: playerY },
    map,
    lateralTolerancePixels:
      laneSize * POKEMON_TRAINER_SIGHT_INTERACTION_LATERAL_TOLERANCE_FACTOR,
  }).detected;
}

export function isPositionInsideEncounterZone(
  x: number,
  y: number,
  zone: SharedMapEncounterZone,
): boolean {
  const { bounds } = zone;

  return (
    x >= bounds.x &&
    x < bounds.x + bounds.width &&
    y >= bounds.y &&
    y < bounds.y + bounds.height
  );
}

export function getServerEncounterZoneAtPosition(
  mapId: MapId,
  x: number,
  y: number,
): ServerMapEncounterZone | undefined {
  const encounterZones = MAP_DATA_REGISTRY[mapId].encounterZones;

  for (const [id, zone] of Object.entries(encounterZones)) {
    if (isPositionInsideEncounterZone(x, y, zone)) {
      return {
        id,
        ...zone,
      };
    }
  }

  return undefined;
}

export function getServerMapStorageTerminal(
  mapId: MapId,
  terminalId: string,
): SharedMapStorageTerminal | undefined {
  const storageTerminals = MAP_DATA_REGISTRY[mapId]
    .storageTerminals as ServerMapStorageTerminalRegistry;

  return storageTerminals[terminalId.trim()];
}

export function isPlayerNearMapStorageTerminal(
  playerX: number,
  playerY: number,
  terminal: SharedMapStorageTerminal,
): boolean {
  const deltaX = playerX - terminal.x;
  const deltaY = playerY - terminal.y;

  const distanceSquared = deltaX * deltaX + deltaY * deltaY;

  const maxDistanceSquared =
    MAX_STORAGE_TERMINAL_INTERACTION_DISTANCE *
    MAX_STORAGE_TERMINAL_INTERACTION_DISTANCE;

  return distanceSquared <= maxDistanceSquared;
}

export function getServerMapHealingStation(
  mapId: MapId,
  healingStationId: string,
): SharedMapHealingStation | undefined {
  const healingStations = MAP_DATA_REGISTRY[mapId]
    .healingStations as ServerMapHealingStationRegistry;

  return healingStations[healingStationId.trim()];
}

export function isPlayerNearMapHealingStation(
  playerX: number,
  playerY: number,
  station: SharedMapHealingStation,
): boolean {
  const deltaX = playerX - station.x;
  const deltaY = playerY - station.y;

  const distanceSquared = deltaX * deltaX + deltaY * deltaY;

  const maxDistanceSquared =
    MAX_HEALING_STATION_INTERACTION_DISTANCE *
    MAX_HEALING_STATION_INTERACTION_DISTANCE;

  return distanceSquared <= maxDistanceSquared;
}
