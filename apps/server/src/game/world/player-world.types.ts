import type { Direction, MapId } from '@cesar-mmo/shared';

export interface PlayerWorldLocation {
  readonly mapId: MapId;
  readonly x: number;
  readonly y: number;
  readonly direction: Direction;
}

export interface PersistedPlayerWorldLocation {
  readonly mapId: string | null;
  readonly x: number | null;
  readonly y: number | null;
  readonly direction: string | null;
}

export interface PlayerRecoveryCheckpoint {
  readonly mapId: MapId;
  readonly x: number;
  readonly y: number;
  readonly direction: Direction;
}

export interface PersistedPlayerRecoveryCheckpoint {
  readonly mapId: string | null;
  readonly x: number | null;
  readonly y: number | null;
  readonly direction: string | null;
}
