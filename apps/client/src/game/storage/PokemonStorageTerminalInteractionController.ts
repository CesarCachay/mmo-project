import Phaser from "phaser";

import { MAP_DATA_REGISTRY, type MapId } from "@cesar-mmo/shared";

const STORAGE_TERMINAL_INTERACTION_DISTANCE = 36;

interface PokemonStorageTerminalTarget {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

interface StorageTerminalCoordinates {
  readonly x: number;
  readonly y: number;
}

export class PokemonStorageTerminalInteractionController {
  private readonly prompt: Phaser.GameObjects.Text;

  private nearbyTerminal?: PokemonStorageTerminalTarget;

  constructor(scene: Phaser.Scene) {
    this.prompt = scene.add
      .text(0, 0, "[E] Usar PC", {
        fontFamily: "Arial",
        fontSize: "9px",
        color: "#ffffff",
        backgroundColor: "rgba(5, 25, 45, 0.82)",
        padding: {
          x: 6,
          y: 3,
        },
        stroke: "#08131c",
        strokeThickness: 1,
      })
      .setOrigin(0.5, 1)
      .setDepth(40)
      .setVisible(false)
      .setResolution(2);
  }

  public get nearbyTerminalId(): string | undefined {
    return this.nearbyTerminal?.id;
  }

  public get hasNearbyTerminal(): boolean {
    return this.nearbyTerminal !== undefined;
  }

  public update(mapId: MapId, playerX: number, playerY: number, blocked: boolean): void {
    if (blocked) {
      this.clear();
      return;
    }

    const terminal = this.findNearestTerminal(mapId, playerX, playerY);

    this.nearbyTerminal = terminal;

    if (!terminal) {
      this.prompt.setVisible(false);
      return;
    }

    this.prompt
      .setPosition(Math.round(terminal.x), Math.round(terminal.y - 16))
      .setVisible(true);
  }

  public clear(): void {
    this.nearbyTerminal = undefined;
    this.prompt.setVisible(false);
  }

  public destroy(): void {
    this.prompt.destroy();
    this.nearbyTerminal = undefined;
  }

  private findNearestTerminal(
    mapId: MapId,
    playerX: number,
    playerY: number
  ): PokemonStorageTerminalTarget | undefined {
    const mapData = MAP_DATA_REGISTRY[mapId];

    const terminals = mapData.storageTerminals as Readonly<
      Record<string, StorageTerminalCoordinates>
    >;

    const maxDistanceSquared =
      STORAGE_TERMINAL_INTERACTION_DISTANCE * STORAGE_TERMINAL_INTERACTION_DISTANCE;

    let nearest: PokemonStorageTerminalTarget | undefined;
    let nearestDistanceSquared = maxDistanceSquared;

    for (const [id, terminal] of Object.entries(terminals)) {
      const deltaX = playerX - terminal.x;
      const deltaY = playerY - terminal.y;
      const distanceSquared = deltaX * deltaX + deltaY * deltaY;

      if (distanceSquared > nearestDistanceSquared) {
        continue;
      }

      nearestDistanceSquared = distanceSquared;
      nearest = {
        id,
        x: terminal.x,
        y: terminal.y,
      };
    }

    return nearest;
  }
}
