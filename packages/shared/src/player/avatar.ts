export const PLAYER_AVATAR_IDS = ["male-01", "female-01"] as const;

export type PlayerAvatarId = (typeof PLAYER_AVATAR_IDS)[number];

export function isPlayerAvatarId(value: unknown): value is PlayerAvatarId {
  return typeof value === "string" && PLAYER_AVATAR_IDS.includes(value as PlayerAvatarId);
}
