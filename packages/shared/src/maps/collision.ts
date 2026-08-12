export type CollisionMap = {
  width: number;
  height: number;

  tileWidth: number;
  tileHeight: number;

  collision: readonly number[];
};

export type Position = {
  x: number;
  y: number;
};

export function isPositionWalkable(
  position: Position,
  playerSize: number,
  map: CollisionMap,
): boolean {
  const halfPlayerSize = playerSize / 2;

  // Evita considerar el tile de al lado cuando el borde
  // del player cae exactamente sobre el límite del tile.
  const epsilon = 0.001;

  const leftTile = Math.floor((position.x - halfPlayerSize) / map.tileWidth);

  const rightTile = Math.floor(
    (position.x + halfPlayerSize - epsilon) / map.tileWidth,
  );

  const topTile = Math.floor((position.y - halfPlayerSize) / map.tileHeight);

  const bottomTile = Math.floor(
    (position.y + halfPlayerSize - epsilon) / map.tileHeight,
  );

  if (
    leftTile < 0 ||
    rightTile >= map.width ||
    topTile < 0 ||
    bottomTile >= map.height
  ) {
    return false;
  }

  for (let tileY = topTile; tileY <= bottomTile; tileY++) {
    for (let tileX = leftTile; tileX <= rightTile; tileX++) {
      const index = tileY * map.width + tileX;

      if (map.collision[index] !== 0) {
        return false;
      }
    }
  }

  return true;
}

export function resolveMapCollision(
  currentPosition: Position,
  nextPosition: Position,
  playerSize: number,
  map: CollisionMap,
): Position {
  let x = currentPosition.x;
  let y = currentPosition.y;

  const horizontalPosition = {
    x: nextPosition.x,
    y: currentPosition.y,
  };

  if (isPositionWalkable(horizontalPosition, playerSize, map)) {
    x = nextPosition.x;
  }

  const verticalPosition = {
    x,
    y: nextPosition.y,
  };

  if (isPositionWalkable(verticalPosition, playerSize, map)) {
    y = nextPosition.y;
  }

  return {
    x,
    y,
  };
}
