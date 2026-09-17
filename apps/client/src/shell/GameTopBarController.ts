import type { MapId } from "@cesar-mmo/shared";

import { initializeGameShell } from "./GameShellController";

import { getGameMapDisplayName } from "./game-map-presentation";

export class GameTopBarController {
  private readonly locationRoot: HTMLDivElement;

  private readonly locationValue: HTMLSpanElement;

  constructor() {
    const gameShell = initializeGameShell();

    // ---------------------------------------------------------
    // Current location
    // ---------------------------------------------------------

    this.locationRoot = document.createElement("div");

    this.locationRoot.className = "game-topbar-location";

    this.locationRoot.hidden = true;

    const locationLabel = document.createElement("span");

    locationLabel.className = "game-topbar-location__label";

    locationLabel.textContent = "Ubicación";

    this.locationValue = document.createElement("span");

    this.locationValue.className = "game-topbar-location__value";

    this.locationRoot.append(locationLabel, this.locationValue);

    gameShell.getTopBarCenter().append(this.locationRoot);
  }

  public setMap(mapId: MapId): void {
    this.locationValue.textContent = getGameMapDisplayName(mapId);

    this.locationRoot.hidden = false;
  }

  public clearWorldContext(): void {
    this.locationValue.textContent = "";

    this.locationRoot.hidden = true;
  }
}

let controller: GameTopBarController | undefined;

export function initializeGameTopBar(): GameTopBarController {
  if (!controller) {
    controller = new GameTopBarController();
  }

  return controller;
}
