import type { CollisionMap, Position } from "../../maps/collision.js";
import type { Direction } from "../../game.types.js";

export const POKEMON_TRAINER_SIGHT_INTERACTION_LATERAL_TOLERANCE_FACTOR = 0.5;

export type PokemonTrainerSightSource = Readonly<{
  position: Position;
  direction: Direction;
  sightRangeTiles: number;
}>;

export type PokemonTrainerSightCheckInput = Readonly<{
  trainer: PokemonTrainerSightSource;
  target: Position;
  map: CollisionMap;
  /**
   * Extra lateral tolerance used by interaction validation.
   * The normal lane already accepts half a tile. Client and server may add
   * a small shared tolerance to absorb prediction/reconciliation and
   * sub-tile movement differences before starting a Trainer interaction.
   */
  lateralTolerancePixels?: number;
}>;

export type PokemonTrainerSightResult = Readonly<{
  detected: boolean;
  forwardDistancePixels: number;
  forwardDistanceTiles: number;
}>;

export function checkPokemonTrainerSight(
  input: PokemonTrainerSightCheckInput,
): PokemonTrainerSightResult {
  const { trainer, target, map } = input;

  if (!Number.isInteger(trainer.sightRangeTiles) || trainer.sightRangeTiles <= 0) {
    return noDetection();
  }

  const deltaX = target.x - trainer.position.x;
  const deltaY = target.y - trainer.position.y;
  const horizontal = trainer.direction === "left" || trainer.direction === "right";
  const tileSize = horizontal ? map.tileWidth : map.tileHeight;
  const laneSize = horizontal ? map.tileHeight : map.tileWidth;
  const lateralDistance = horizontal ? Math.abs(deltaY) : Math.abs(deltaX);
  const lateralTolerancePixels = Math.max(0, input.lateralTolerancePixels ?? 0);

  if (lateralDistance > laneSize / 2 + lateralTolerancePixels) {
    return noDetection();
  }

  const forwardDistancePixels = getForwardDistance(
    trainer.direction,
    deltaX,
    deltaY,
  );

  if (forwardDistancePixels <= 0) {
    return noDetection();
  }

  const maxDistancePixels = trainer.sightRangeTiles * tileSize;

  if (forwardDistancePixels > maxDistancePixels) {
    return noDetection();
  }

  /*
   * Lateral tolerance means the target may be slightly outside the exact
   * Trainer lane. Collision must still be checked along the Trainer's
   * forward ray, otherwise a tolerated target in a neighbouring tile can
   * never be reached by the one-axis traversal below.
   */
  const collisionTarget = horizontal
    ? { x: target.x, y: trainer.position.y }
    : { x: trainer.position.x, y: target.y };

  if (
    hasBlockingCollisionBetween(
      trainer.position,
      collisionTarget,
      trainer.direction,
      map,
    )
  ) {
    return noDetection();
  }

  return {
    detected: true,
    forwardDistancePixels,
    forwardDistanceTiles: forwardDistancePixels / tileSize,
  };
}

function noDetection(): PokemonTrainerSightResult {
  return {
    detected: false,
    forwardDistancePixels: 0,
    forwardDistanceTiles: 0,
  };
}

function getForwardDistance(
  direction: Direction,
  deltaX: number,
  deltaY: number,
): number {
  switch (direction) {
    case "up":
      return -deltaY;
    case "down":
      return deltaY;
    case "left":
      return -deltaX;
    case "right":
      return deltaX;
  }
}

function hasBlockingCollisionBetween(
  trainer: Position,
  target: Position,
  direction: Direction,
  map: CollisionMap,
): boolean {
  const trainerTileX = Math.floor(trainer.x / map.tileWidth);
  const trainerTileY = Math.floor(trainer.y / map.tileHeight);
  const targetTileX = Math.floor(target.x / map.tileWidth);
  const targetTileY = Math.floor(target.y / map.tileHeight);

  let tileX = trainerTileX;
  let tileY = trainerTileY;

  while (true) {
    switch (direction) {
      case "up":
        tileY -= 1;
        break;
      case "down":
        tileY += 1;
        break;
      case "left":
        tileX -= 1;
        break;
      case "right":
        tileX += 1;
        break;
    }

    if (tileX === targetTileX && tileY === targetTileY) {
      return false;
    }

    if (tileX < 0 || tileX >= map.width || tileY < 0 || tileY >= map.height) {
      return true;
    }

    const collisionIndex = tileY * map.width + tileX;

    if (map.collision[collisionIndex] !== 0) {
      return true;
    }
  }
}
