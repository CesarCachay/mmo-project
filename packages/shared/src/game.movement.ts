import { PLAYER_SPEED } from "./game.constants.js";

import type { Player, PlayerInput, Direction } from "./game.types.js";

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

export function applyPlayerMovement(
  player: Player,
  input: PlayerInput,
  deltaSeconds: number,
) {
  const movement = getMovementDelta(input, deltaSeconds);

  return {
    ...player,
    x: player.x + movement.x,
    y: player.y + movement.y,
  };
}

export function getDirectionFromInput(
  input: PlayerInput,
  currentDirection: Direction,
): Direction {
  if (input.left) {
    return "left";
  }

  if (input.right) {
    return "right";
  }

  if (input.up) {
    return "up";
  }

  if (input.down) {
    return "down";
  }

  return currentDirection;
}

export function isPlayerMoving(input: PlayerInput): boolean {
  return input.up || input.down || input.left || input.right;
}
