import Phaser from "phaser";

import type { MapId } from "@cesar-mmo/shared";

import { findNearestPokemonCenterHealingStation } from "./pokemon-center-healing-target";

import type { PokemonCenterHealingStationTarget } from "./pokemon-center-healing-target";

export interface PokemonCenterHealingInteractionControllerOptions {
  readonly onHealRequested: (healingStationId: string) => void;
}

export class PokemonCenterHealingInteractionController {
  private readonly prompt: Phaser.GameObjects.Text;
  private readonly onHealRequested: PokemonCenterHealingInteractionControllerOptions["onHealRequested"];

  private nearbyStation?: PokemonCenterHealingStationTarget;
  private requestPending = false;

  constructor(
    scene: Phaser.Scene,
    options: PokemonCenterHealingInteractionControllerOptions
  ) {
    this.onHealRequested = options.onHealRequested;

    this.prompt = scene.add
      .text(0, 0, "[E] Curar Pokémon", {
        fontFamily: "Arial",
        fontSize: "9px",
        color: "#ffffff",
        backgroundColor: "rgba(172, 32, 45, 0.92)",
        padding: {
          x: 6,
          y: 3,
        },
        stroke: "#541018",
        strokeThickness: 1,
      })
      .setOrigin(0.5, 1)
      .setDepth(40)
      .setVisible(false)
      .setResolution(2);
  }

  public get nearbyStationId(): string | undefined {
    return this.nearbyStation?.id;
  }

  public get hasNearbyStation(): boolean {
    return this.nearbyStation !== undefined;
  }

  public get isPending(): boolean {
    return this.requestPending;
  }

  public update(mapId: MapId, playerX: number, playerY: number, blocked: boolean): void {
    if (blocked || this.requestPending) {
      this.clearNearbyStation();

      return;
    }

    const station = findNearestPokemonCenterHealingStation(mapId, playerX, playerY);

    this.nearbyStation = station;

    if (!station) {
      this.prompt.setVisible(false);

      return;
    }

    this.prompt
      .setPosition(Math.round(station.x), Math.round(station.y - 16))
      .setVisible(true);
  }

  public requestHealing(): void {
    if (this.requestPending) {
      return;
    }

    const stationId = this.nearbyStation?.id;

    if (!stationId) {
      return;
    }

    /* Lock client-side. Evita enviar múltiples solicitudes */
    this.requestPending = true;

    this.clearNearbyStation();

    this.onHealRequested(stationId);
  }

  public completeRequest(): void {
    this.requestPending = false;
  }

  public clear(): void {
    this.requestPending = false;
    this.clearNearbyStation();
  }

  public destroy(): void {
    this.clear();
    this.prompt.destroy();
  }

  private clearNearbyStation(): void {
    this.nearbyStation = undefined;
    this.prompt.setVisible(false);
  }
}
