import type { MapId } from "@cesar-mmo/shared";

import { findNearestPokemonCenterHealingStation } from "./pokemon-center-healing-target";

import type {
  PokemonCenterHealingStationTarget,
} from "./pokemon-center-healing-target";

export interface PokemonCenterHealingInteractionControllerOptions {
  readonly onHealRequested: (
    healingStationId: string,
  ) => void;
}

/*
 * Milestone 1.31:
 *
 * This controller owns INTERACTION STATE only.
 * Prompt rendering moved to the shared DOM InteractionPrompt.
 *
 * `_scene` is intentionally kept in the constructor so the
 * current GameScene composition does not need to change yet.
 * It is typed as unknown to avoid importing Phaser in a
 * presentation-free controller.
 */
export class PokemonCenterHealingInteractionController {
  private readonly onHealRequested:
    PokemonCenterHealingInteractionControllerOptions["onHealRequested"];

  private nearbyStation?:
    PokemonCenterHealingStationTarget;

  private requestPending = false;

  constructor(
    _scene: unknown,
    options:
      PokemonCenterHealingInteractionControllerOptions,
  ) {
    this.onHealRequested =
      options.onHealRequested;
  }

  public get nearbyStationId():
    string | undefined {
    return this.nearbyStation?.id;
  }

  public get hasNearbyStation():
    boolean {
    return this.nearbyStation !== undefined;
  }

  public get isPending():
    boolean {
    return this.requestPending;
  }

  public update(
    mapId: MapId,
    playerX: number,
    playerY: number,
    blocked: boolean,
  ): void {
    if (
      blocked ||
      this.requestPending
    ) {
      this.clearNearbyStation();
      return;
    }

    this.nearbyStation =
      findNearestPokemonCenterHealingStation(
        mapId,
        playerX,
        playerY,
      );
  }

  public requestHealing(): void {
    if (this.requestPending) {
      return;
    }

    const stationId =
      this.nearbyStation?.id;

    if (!stationId) {
      return;
    }

    /*
     * Client-side duplicate-request guard.
     * Server remains authoritative.
     */
    this.requestPending = true;

    this.clearNearbyStation();

    this.onHealRequested(
      stationId,
    );
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
  }

  private clearNearbyStation(): void {
    this.nearbyStation = undefined;
  }
}
