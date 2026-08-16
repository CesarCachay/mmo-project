export type { Player, PlayerInput, Direction } from "./game.types.js";

export {
  PLAYER_COLORS,
  PLAYER_SIZE,
  PLAYER_SPEED,
  SERVER_TICK_RATE,
} from "./game.constants.js";

export {
  getMovementDelta,
  applyPlayerMovement,
  getDirectionFromInput,
  isPlayerMoving,
} from "./game.movement.js";

export { TOWN_01_MAP } from "./maps/generated/town-01.js";

export { isPositionWalkable, resolveMapCollision } from "./maps/collision.js";

export type { CollisionMap, Position } from "./maps/collision.js";

export { PLAYER_AVATAR_IDS, isPlayerAvatarId } from "./player/avatar.js";
export type { PlayerAvatarId } from "./player/avatar.js";

export type { ChatMessage, ChatMessageInput, ChatMessageSender } from "./chat.js";
export { CHAT_EVENTS, CHAT_MESSAGE_MAX_LENGTH, isChatMessageInput } from "./chat.js";
