import { MAP_DATA_REGISTRY } from '@cesar-mmo/shared';

import type {
  MapId,
  SharedMapSpawn,
  SharedMapTransition,
  SharedMapNpc,
} from '@cesar-mmo/shared';

const MAP_TRANSITION_TRIGGER_TOLERANCE = 8;

const NPC_INTERACTION_DISTANCE = 36;

const NPC_INTERACTION_SERVER_TOLERANCE = 4;

const MAX_NPC_INTERACTION_DISTANCE =
  NPC_INTERACTION_DISTANCE + NPC_INTERACTION_SERVER_TOLERANCE;

export function getServerMapTransition(
  mapId: MapId,
  transitionId: string,
): SharedMapTransition | undefined {
  return MAP_DATA_REGISTRY[mapId].transitions[transitionId.trim()];
}

export function getServerMapSpawn(
  mapId: MapId,
  spawnId: string,
): SharedMapSpawn | undefined {
  return MAP_DATA_REGISTRY[mapId].spawns[spawnId];
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
  const npcs = MAP_DATA_REGISTRY[mapId].npcs;

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
