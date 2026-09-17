import "./right-hud-rail.css";

export type RightHudRailPanel = "party" | "inventory" | "trainer";

export interface RightHudRailOptions {
  readonly onPartyRequested: () => void;

  readonly onBagRequested: () => void;

  readonly onTrainerRequested: () => void;
}

interface HudRailButtonDefinition {
  readonly label: string;
  readonly icon: string;
  readonly shortcut?: string;
  readonly disabled?: boolean;
  readonly title?: string;
  readonly onClick?: () => void;
}

export class RightHudRail {
  private readonly root: HTMLDivElement;

  private readonly partyButton: HTMLButtonElement;

  private readonly bagButton: HTMLButtonElement;

  private readonly trainerButton: HTMLButtonElement;

  constructor(options: RightHudRailOptions) {
    const app = document.getElementById("app");

    if (!(app instanceof HTMLDivElement)) {
      throw new Error('RightHudRail requires "#app"');
    }

    this.root = document.createElement("div");

    this.root.className = "right-hud-rail";

    this.root.hidden = true;

    this.root.setAttribute("aria-label", "Accesos del Trainer");

    this.partyButton = this.createButton({
      label: "Party",
      icon: "P",
      shortcut: "P",
      title: "Party [P]",
      onClick: options.onPartyRequested,
    });

    this.bagButton = this.createButton({
      label: "Bag",
      icon: "B",
      shortcut: "I",
      title: "Bag [I]",
      onClick: options.onBagRequested,
    });

    this.trainerButton = this.createButton({
      label: "Trainer",
      icon: "T",
      title: "Perfil del Trainer",
      onClick: options.onTrainerRequested,
    });

    this.root.append(this.partyButton, this.bagButton, this.trainerButton);

    app.append(this.root);
  }

  public setVisible(visible: boolean): void {
    this.root.hidden = !visible;
  }

  public setActivePanel(panel: RightHudRailPanel | undefined): void {
    this.setButtonActive(this.partyButton, panel === "party");

    this.setButtonActive(this.bagButton, panel === "inventory");

    this.setButtonActive(this.trainerButton, panel === "trainer");
  }

  public destroy(): void {
    this.root.remove();
  }

  private createButton(definition: HudRailButtonDefinition): HTMLButtonElement {
    const button = document.createElement("button");

    button.type = "button";

    button.className = "right-hud-rail__button";

    button.disabled = definition.disabled ?? false;

    button.title = definition.title ?? definition.label;

    button.setAttribute("aria-label", definition.title ?? definition.label);

    button.setAttribute("aria-pressed", "false");

    const icon = document.createElement("span");

    icon.className = "right-hud-rail__icon";

    icon.textContent = definition.icon;

    icon.setAttribute("aria-hidden", "true");

    const label = document.createElement("span");

    label.className = "right-hud-rail__label";

    label.textContent = definition.label;

    button.append(icon, label);

    if (definition.shortcut) {
      const shortcut = document.createElement("span");

      shortcut.className = "right-hud-rail__shortcut";

      shortcut.textContent = definition.shortcut;

      shortcut.setAttribute("aria-hidden", "true");

      button.append(shortcut);
    }

    if (definition.onClick) {
      button.addEventListener("click", () => {
        definition.onClick?.();
        button.blur();
      });
    }

    return button;
  }

  private setButtonActive(button: HTMLButtonElement, active: boolean): void {
    button.classList.toggle("right-hud-rail__button--active", active);

    button.setAttribute("aria-pressed", active ? "true" : "false");
  }
}
