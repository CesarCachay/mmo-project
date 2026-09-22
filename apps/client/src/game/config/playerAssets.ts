import type { Direction, PlayerAvatarId } from "@cesar-mmo/shared";

type PlayerAvatarConfig = {
  id: PlayerAvatarId;
  label: string;
  path: string;
};

export const PLAYER_AVATARS = {
  "male-01": {
    id: "male-01",
    label: "Hombre 01",
    path: "assets/characters/players/male-01",
  },
  "female-01": {
    id: "female-01",
    label: "Mujer 01",
    path: "assets/characters/players/female-01",
  },
  "black-trainer": {
    id: "black-trainer",
    label: "Hombre 02",
    path: "assets/characters/players/black-trainer",
  },
  "female-02": {
    id: "female-02",
    label: "Mujer 02",
    path: "assets/characters/players/female-02",
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
