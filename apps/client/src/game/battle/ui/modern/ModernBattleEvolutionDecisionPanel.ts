import type { PokemonEvolutionDecision } from "@cesar-mmo/shared";

export interface EvolutionDecisionPrompt {
  readonly pokemonInstanceId: string;

  readonly pokemonName: string;

  readonly sourceSpeciesId: number;
  readonly sourceFormId: number;

  readonly targetSpeciesId: number;
  readonly targetFormId: number;
}

export class ModernBattleEvolutionDecisionPanel {
  private readonly root: HTMLDivElement;

  private readonly title: HTMLDivElement;

  private readonly actions: HTMLDivElement;

  private readonly acceptButton: HTMLButtonElement;

  private readonly cancelButton: HTMLButtonElement;

  private resolver?: (decision: PokemonEvolutionDecision) => void;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");

    this.root.className = [
      "battle-modern-evolution-decision",
      "battle-ui-modern__interactive",
    ].join(" ");

    this.title = document.createElement("div");

    this.title.className = "battle-modern-evolution-decision__title";

    this.actions = document.createElement("div");

    this.actions.className = "battle-modern-evolution-decision__actions";

    this.acceptButton = document.createElement("button");

    this.acceptButton.type = "button";

    this.acceptButton.className = "battle-modern-evolution-decision__accept";

    this.acceptButton.textContent = "EVOLVE";

    this.acceptButton.addEventListener("click", () => {
      this.resolve({
        type: "accept",
      });
    });

    this.cancelButton = document.createElement("button");

    this.cancelButton.type = "button";

    this.cancelButton.className = "battle-modern-evolution-decision__cancel";

    this.cancelButton.textContent = "CANCEL";

    this.cancelButton.addEventListener("click", () => {
      this.resolve({
        type: "cancel",
      });
    });

    this.actions.append(this.acceptButton, this.cancelButton);

    this.root.append(this.title, this.actions);

    parent.appendChild(this.root);

    this.setVisible(false);
  }

  public prompt(
    input: EvolutionDecisionPrompt,
  ): Promise<PokemonEvolutionDecision> {
    this.title.textContent = `${input.pokemonName} can evolve. Allow the evolution?`;

    this.setWaiting(false);
    this.setVisible(true);

    return new Promise((resolve) => {
      this.resolver = resolve;
    });
  }

  public setWaiting(waiting: boolean): void {
    this.acceptButton.disabled = waiting;
    this.cancelButton.disabled = waiting;
  }

  public setVisible(visible: boolean): void {
    this.root.hidden = !visible;
  }

  public setBounds(
    bounds: {
      x: number;
      y: number;
      width: number;
      height: number;
    },

    viewport: {
      width: number;
      height: number;
    },
  ): void {
    if (viewport.width <= 0 || viewport.height <= 0) {
      return;
    }

    const left = bounds.x - bounds.width / 2;

    const top = bounds.y - bounds.height / 2;

    this.root.style.left = `${(left / viewport.width) * 100}%`;

    this.root.style.top = `${(top / viewport.height) * 100}%`;

    this.root.style.width = `${(bounds.width / viewport.width) * 100}%`;

    this.root.style.height = `${(bounds.height / viewport.height) * 100}%`;
  }

  public clear(): void {
    this.resolver = undefined;
    this.setWaiting(false);
    this.setVisible(false);
  }

  public destroy(): void {
    this.resolver = undefined;
    this.root.remove();
  }

  private resolve(decision: PokemonEvolutionDecision): void {
    const resolver = this.resolver;

    if (!resolver) {
      return;
    }

    /* Prevent double submission while waiting for the authoritative server response */
    this.resolver = undefined;

    this.setWaiting(true);

    resolver(decision);
  }
}
