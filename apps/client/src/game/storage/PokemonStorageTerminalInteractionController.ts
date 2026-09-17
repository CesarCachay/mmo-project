import {
  MAP_DATA_REGISTRY,
  type MapId,
} from "@cesar-mmo/shared";

const STORAGE_TERMINAL_INTERACTION_DISTANCE = 36;
const STORAGE_TERMINAL_INTERACTION_DISTANCE_SQUARED =
  STORAGE_TERMINAL_INTERACTION_DISTANCE *
  STORAGE_TERMINAL_INTERACTION_DISTANCE;

interface StorageTerminalTarget {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

/*
 * Milestone 1.31:
 *
 * This controller owns NEARBY TERMINAL DETECTION only.
 * Prompt rendering moved to the shared DOM InteractionPrompt.
 *
 * `_scene` is intentionally kept so existing GameScene
 * composition `new PokemonStorageTerminalInteractionController(this)`
 * remains valid without importing Phaser here.
 */
export class PokemonStorageTerminalInteractionController {
  private nearbyTerminal?:
    StorageTerminalTarget;

  constructor(_scene?: unknown) {}

  public get nearbyTerminalId():
    string | undefined {
    return this.nearbyTerminal?.id;
  }

  public get hasNearbyTerminal():
    boolean {
    return this.nearbyTerminal !== undefined;
  }

  public update(
    mapId: MapId,
    playerX: number,
    playerY: number,
    blocked: boolean,
  ): void {
    if (blocked) {
      this.clear();
      return;
    }

    const terminals =
      MAP_DATA_REGISTRY[mapId]
        .storageTerminals;

    let nearest:
      StorageTerminalTarget
      | undefined;

    let nearestDistanceSquared =
      Number.POSITIVE_INFINITY;

    for (
      const [id, terminal]
      of Object.entries(terminals)
    ) {
      const deltaX =
        playerX - terminal.x;

      const deltaY =
        playerY - terminal.y;

      const distanceSquared =
        deltaX * deltaX +
        deltaY * deltaY;

      if (
        distanceSquared >
        STORAGE_TERMINAL_INTERACTION_DISTANCE_SQUARED
      ) {
        continue;
      }

      if (
        distanceSquared >=
        nearestDistanceSquared
      ) {
        continue;
      }

      nearestDistanceSquared =
        distanceSquared;

      nearest = {
        id,
        x: terminal.x,
        y: terminal.y,
      };
    }

    this.nearbyTerminal =
      nearest;
  }

  public clear(): void {
    this.nearbyTerminal =
      undefined;
  }

  public destroy(): void {
    this.clear();
  }
}
