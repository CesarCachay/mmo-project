import { PlayerAvatarId } from "./player/avatar.js";
import { MapId } from "./map.js";

export type Player = {
  id: string;
  mapId: MapId;
  x: number;
  y: number;
  color: number;
  isMoving: boolean;
  direction: Direction;
  displayName: string;
  avatarId: PlayerAvatarId;
  lastProcessedInputSequence: number;
};

export type PlayerInput = {
  sequence: number;
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
};

export type Direction = "up" | "down" | "left" | "right";
