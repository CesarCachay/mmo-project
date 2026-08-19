import { MAP_DATA_REGISTRY } from '@cesar-mmo/shared';

import type {
  MapId,
  SharedMapSpawn,
  SharedMapTransition,
} from '@cesar-mmo/shared';

const MAP_TRANSITION_TRIGGER_TOLERANCE = 8;

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
