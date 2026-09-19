import type { MapId, PlayerAvatarId } from "@cesar-mmo/shared";

export const WORLD_LOADING_SCENE_KEY = "WorldLoadingScene";

export const GAME_SCENE_KEY = "GameScene";

export const WORLD_READY_EVENT = "world:ready";

export const WORLD_BOOT_ABORTED_EVENT = "world:boot-aborted";

export type WorldEntryData = Readonly<{
  avatarId: PlayerAvatarId;
}>;

export type WorldReadyPayload = Readonly<{
  mapId: MapId;
}>;
