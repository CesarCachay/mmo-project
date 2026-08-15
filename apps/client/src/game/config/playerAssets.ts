import type { Direction, PlayerAvatarId } from "@cesar-mmo/shared";

type PlayerAvatarConfig = {
  id: PlayerAvatarId;
  label: string;
  path: string;
};

export const PLAYER_AVATARS = {
  "male-01": {
    id: "male-01",
    label: "Hombre",
    path: "assets/characters/players/male-01",
  },

  "female-01": {
    id: "female-01",
    label: "Mujer",
    path: "assets/characters/players/female-01",
  },
} satisfies Record<PlayerAvatarId, PlayerAvatarConfig>;

export const PLAYER_DIRECTIONS: Direction[] = ["down", "left", "right", "up"];

export function getPlayerTextureKey(
  avatarId: PlayerAvatarId,
  direction: Direction
): string {
  return `player-${avatarId}-walk-${direction}`;
}

export function getPlayerAnimationKey(
  avatarId: PlayerAvatarId,
  direction: Direction
): string {
  return `player-${avatarId}-walk-${direction}-animation`;
}
