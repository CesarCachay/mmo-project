import "./mobile-trainer-hud-dock.css";

import type { TrainerPanelSurface } from "./TrainerPanelController";

export interface MobileTrainerHudDockOptions {
  readonly onPartyRequested: () => void;
  readonly onBagRequested: () => void;
  readonly onTrainerRequested: () => void;
}

interface MobileTrainerHudButtonDefinition {
  readonly panel: TrainerPanelSurface;
  readonly label: string;
  readonly icon: string;
  readonly onClick: () => void;
}

export class MobileTrainerHudDock {
  private readonly root: HTMLElement;
  private readonly partyButton: HTMLButtonElement;
  private readonly bagButton: HTMLButtonElement;
  private readonly trainerButton: HTMLButtonElement;

  constructor(options: MobileTrainerHudDockOptions) {
    const app = document.getElementById("app");

    if (!(app instanceof HTMLElement)) {
      throw new Error('MobileTrainerHudDock requires "#app"');
    }

    this.root = document.createElement("nav");

    this.root.className = "mobile-trainer-hud-dock";

    this.root.hidden = true;

    this.root.setAttribute("aria-label", "Trainer menu");

    this.partyButton = this.createButton({
      panel: "party",
      label: "Party",
      icon: "P",
      onClick: options.onPartyRequested,
    });

    this.bagButton = this.createButton({
      panel: "inventory",
      label: "Bag",
      icon: "B",
      onClick: options.onBagRequested,
    });

    this.trainerButton = this.createButton({
      panel: "trainer",
      label: "Trainer",
      icon: "T",
      onClick: options.onTrainerRequested,
    });

    this.root.append(this.partyButton, this.bagButton, this.trainerButton);

    app.append(this.root);
  }

  public setVisible(visible: boolean): void {
    this.root.hidden = !visible;
  }

  public setActivePanel(panel: TrainerPanelSurface | undefined): void {
    this.setButtonActive(this.partyButton, panel === "party");
    this.setButtonActive(this.bagButton, panel === "inventory");
    this.setButtonActive(this.trainerButton, panel === "trainer");
  }

  public destroy(): void {
    this.root.remove();
  }

  private createButton(definition: MobileTrainerHudButtonDefinition): HTMLButtonElement {
    const button = document.createElement("button");

    button.type = "button";

    button.className = "mobile-trainer-hud-dock__button";

    button.dataset.panel = definition.panel;

    button.setAttribute("aria-label", definition.label);

    button.setAttribute("aria-pressed", "false");

    const icon = document.createElement("span");

    icon.className = "mobile-trainer-hud-dock__icon";

    icon.textContent = definition.icon;

    icon.setAttribute("aria-hidden", "true");

    const label = document.createElement("span");

    label.className = "mobile-trainer-hud-dock__label";

    label.textContent = definition.label;

    button.append(icon, label);

    button.addEventListener("click", () => {
      definition.onClick();
      button.blur();
    });

    return button;
  }

  private setButtonActive(button: HTMLButtonElement, active: boolean): void {
    button.classList.toggle("mobile-trainer-hud-dock__button--active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  }
}
