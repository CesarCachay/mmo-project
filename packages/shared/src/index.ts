export type { Player, PlayerInput } from "./game.types.js";

export {
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
  PLAYER_COLORS,
  PLAYER_SIZE,
  PLAYER_SPEED,
  SERVER_TICK_RATE,
} from "./game.constants.js";

export {
  getMovementDelta,
  clampPlayerPosition,
  applyPlayerMovement,
} from "./game.movement.js";

export { TOWN_01_MAP } from "./maps/generated/town-01.js";

export { isPositionWalkable, resolveMapCollision } from "./maps/collision.js";

export type { CollisionMap, Position } from "./maps/collision.js";
