import Phaser from "phaser";

import { POKEMON_STARTERS, type PokemonStarterId } from "@cesar-mmo/shared";

import { POKEMON_STARTER_ASSETS } from "../pokemon/pokemon-starter-assets";

import { GameViewportOverlay } from "../../shell/GameViewportOverlay";

type StarterSelectionPanelOptions = {
  onSelect: (starterId: PokemonStarterId) => void;
};

type StarterRegion = "KANTO" | "JOHTO" | "HOENN" | "SINNOH";

const STARTERS_BY_REGION: Record<StarterRegion, PokemonStarterId[]> = {
  KANTO: ["BULBASAUR", "CHARMANDER", "SQUIRTLE"],
  JOHTO: ["CHIKORITA", "CYNDAQUIL", "TOTODILE"],
  HOENN: ["TREECKO", "TORCHIC", "MUDKIP"],
  SINNOH: ["TURTWIG", "CHIMCHAR", "PIPLUP"],
};

const REGIONS: readonly StarterRegion[] = ["KANTO", "JOHTO", "HOENN", "SINNOH"];

export class StarterSelectionPanel {
  private readonly overlay: GameViewportOverlay;
  private readonly panel: HTMLDivElement;
  private readonly title: HTMLHeadingElement;
  private readonly subtitle: HTMLParagraphElement;
  private readonly content: HTMLDivElement;
  private readonly onSelect: (starterId: PokemonStarterId) => void;

  private selectionPending = false;

  constructor(scene: Phaser.Scene, options: StarterSelectionPanelOptions) {
    this.onSelect = options.onSelect;

    this.overlay = new GameViewportOverlay("starter-selection-overlay");

    this.panel = document.createElement("div");
    this.panel.className = "starter-selection-panel";

    this.title = document.createElement("h2");
    this.title.className = "starter-selection-panel__title";

    this.subtitle = document.createElement("p");
    this.subtitle.className = "starter-selection-panel__subtitle";

    this.content = document.createElement("div");
    this.content.className = "starter-selection-panel__content";

    const header = document.createElement("header");
    header.className = "starter-selection-panel__header";
    header.append(this.title, this.subtitle);

    this.panel.append(header, this.content);
    this.overlay.mount(this.panel);
    this.overlay.setVisible(false);

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.destroy();
    });

    this.showRegionSelection();
  }

  public show(): void {
    this.selectionPending = false;
    this.showRegionSelection();
    this.overlay.setVisible(true);
  }

  public hide(): void {
    this.overlay.setVisible(false);
  }

  public isVisible(): boolean {
    return this.overlay.isVisible;
  }

  public setSelectionPending(pending: boolean): void {
    this.selectionPending = pending;

    this.panel.classList.toggle("starter-selection-panel--pending", pending);

    this.panel.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      button.disabled = pending;
    });

    if (pending) {
      this.subtitle.textContent = "Confirming selection...";
    }
  }

  public destroy(): void {
    this.overlay.destroy();
  }

  private showRegionSelection(): void {
    this.selectionPending = false;

    this.title.textContent = "Choose your region";
    this.subtitle.textContent = "Select the region of your first Pokémon";
    this.content.replaceChildren();

    const grid = document.createElement("div");

    grid.className = "starter-region-grid";

    for (const region of REGIONS) {
      const button = document.createElement("button");

      button.type = "button";
      button.className = "starter-region-card";
      button.textContent = region;

      button.addEventListener("click", () => {
        if (this.selectionPending) {
          return;
        }

        this.showStarterSelection(region);
      });

      grid.append(button);
    }

    this.content.append(grid);
  }

  private showStarterSelection(region: StarterRegion): void {
    this.selectionPending = false;

    this.title.textContent = `${region} starters`;
    this.subtitle.textContent = "Choose your first Pokémon";
    this.content.replaceChildren();

    const grid = document.createElement("div");

    grid.className = "starter-pokemon-grid";

    for (const starterId of STARTERS_BY_REGION[region]) {
      const starter = POKEMON_STARTERS[starterId];
      const asset = POKEMON_STARTER_ASSETS[starterId];
      const button = document.createElement("button");

      button.type = "button";
      button.className = "starter-pokemon-card";

      const image = document.createElement("img");
      image.className = "starter-pokemon-card__sprite";

      image.src = asset.path;
      image.alt = this.getStarterDisplayName(starterId);

      image.draggable = false;

      const name = document.createElement("span");
      name.className = "starter-pokemon-card__name";
      name.textContent = this.getStarterDisplayName(starterId);

      const level = document.createElement("span");
      level.className = "starter-pokemon-card__level";
      level.textContent = `Lv. ${starter.level}`;

      button.append(image, name, level);

      button.addEventListener("click", () => {
        if (this.selectionPending) {
          return;
        }

        this.setSelectionPending(true);

        this.onSelect(starterId);
      });

      grid.append(button);
    }

    const back = document.createElement("button");

    back.type = "button";

    back.className = "starter-selection-panel__back";

    back.textContent = "← Back";

    back.addEventListener("click", () => {
      if (this.selectionPending) {
        return;
      }

      this.showRegionSelection();
    });

    this.content.append(grid, back);
  }

  private getStarterDisplayName(starterId: PokemonStarterId): string {
    const normalized = starterId.toLowerCase();
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }
}
