import {
  GAME_HEIGHT,
  GAME_WIDTH,
  PLAYER_SIZE,
  PLAYER_SPEED,
} from "./game.constants.js";

import type { Player, PlayerInput } from "./game.types.js";

export type MovementDelta = {
  x: number;
  y: number;
};

export function getMovementDelta(
  input: PlayerInput,
  deltaSeconds: number,
): MovementDelta {
  let directionX = 0;
  let directionY = 0;

  if (input.left) {
    directionX -= 1;
  }

  if (input.right) {
    directionX += 1;
  }

  if (input.up) {
    directionY -= 1;
  }

  if (input.down) {
    directionY += 1;
  }

  if (directionX === 0 && directionY === 0) {
    return {
      x: 0,
      y: 0,
    };
  }

  const magnitude = Math.sqrt(
    directionX * directionX + directionY * directionY,
  );

  const normalizedX = directionX / magnitude;

  const normalizedY = directionY / magnitude;

  return {
    x: normalizedX * PLAYER_SPEED * deltaSeconds,

    y: normalizedY * PLAYER_SPEED * deltaSeconds,
  };
}

export function clampPlayerPosition(position: { x: number; y: number }) {
  const halfPlayerSize = PLAYER_SIZE / 2;

  return {
    x: Math.max(
      halfPlayerSize,
      Math.min(GAME_WIDTH - halfPlayerSize, position.x),
    ),

    y: Math.max(
      halfPlayerSize,
      Math.min(GAME_HEIGHT - halfPlayerSize, position.y),
    ),
  };
}

export function applyPlayerMovement(
  player: Player,
  input: PlayerInput,
  deltaSeconds: number,
) {
  const movement = getMovementDelta(input, deltaSeconds);

  const nextPosition = clampPlayerPosition({
    x: player.x + movement.x,
    y: player.y + movement.y,
  });

  return {
    ...player,
    x: nextPosition.x,
    y: nextPosition.y,
  };
}
