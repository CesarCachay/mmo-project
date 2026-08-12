export type { Player, PlayerInput } from "./game.types.js";

export {
  GAME_HEIGHT,
  GAME_WIDTH,
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
