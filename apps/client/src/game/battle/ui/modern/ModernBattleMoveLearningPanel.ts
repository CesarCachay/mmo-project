import { getPokemonMove } from "@cesar-mmo/shared";

import type {
  PokemonInstanceMove,
  PokemonMoveLearningDecision,
} from "@cesar-mmo/shared";

export interface MoveLearningPrompt {
  readonly pokemonName: string;
  readonly candidateMoveId: number;
  readonly currentMoves: readonly PokemonInstanceMove[];
}

export class ModernBattleMoveLearningPanel {
  private readonly root: HTMLDivElement;
  private readonly title: HTMLDivElement;
  private readonly grid: HTMLDivElement;
  private readonly cancelButton: HTMLButtonElement;
  private resolver?: (decision: PokemonMoveLearningDecision) => void;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");

    this.root.className = [
      "battle-modern-move-learning",
      "battle-ui-modern__interactive",
    ].join(" ");

    this.title = document.createElement("div");

    this.title.className = "battle-modern-move-learning__title";

    this.grid = document.createElement("div");

    this.grid.className = "battle-modern-moves__grid";

    this.cancelButton = document.createElement("button");

    this.cancelButton.type = "button";

    this.cancelButton.className = "battle-move-learning__cancel";

    this.cancelButton.textContent = "CANCEL";

    this.cancelButton.addEventListener("click", () => {
      this.resolve({
        type: "cancel",
      });
    });

    this.root.append(this.title, this.grid, this.cancelButton);

    parent.appendChild(this.root);

    this.setVisible(false);
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

  public prompt(
    input: MoveLearningPrompt,
  ): Promise<PokemonMoveLearningDecision> {
    this.grid.replaceChildren();

    const candidate = getPokemonMove(input.candidateMoveId);

    const candidateName = candidate
      ? this.formatMoveName(candidate.name)
      : `Move ${input.candidateMoveId}`;

    this.title.textContent = `${input.pokemonName} wants to learn ${candidateName}. Choose a move to forget.`;

    for (const instanceMove of input.currentMoves) {
      const move = getPokemonMove(instanceMove.moveId);

      const button = document.createElement("button");

      button.type = "button";

      button.className = "battle-modern-move-card";

      const name = move
        ? this.formatMoveName(move.name)
        : `Move ${instanceMove.moveId}`;

      button.textContent = `${name} · PP ${instanceMove.currentPp}`;

      /* Important: PP = 0 does NOT prevent forgetting */
      button.addEventListener("click", () => {
        this.resolve({
          type: "forget",
          moveId: instanceMove.moveId,
        });
      });

      this.grid.appendChild(button);
    }

    this.setWaiting(false);
    this.setVisible(true);

    return new Promise((resolve) => {
      this.resolver = resolve;
    });
  }

  public setWaiting(waiting: boolean): void {
    for (const button of this.grid.querySelectorAll("button")) {
      button.disabled = waiting;
    }

    this.cancelButton.disabled = waiting;
  }

  public setVisible(visible: boolean): void {
    this.root.hidden = !visible;
  }

  public clear(): void {
    this.resolver = undefined;

    this.grid.replaceChildren();

    this.root.hidden = true;
  }

  public destroy(): void {
    this.resolver = undefined;

    this.root.remove();
  }

  private resolve(decision: PokemonMoveLearningDecision): void {
    const resolver = this.resolver;

    if (!resolver) {
      return;
    }

    /* Prevent double-click before server ACK */
    this.resolver = undefined;

    this.setWaiting(true);

    resolver(decision);
  }

  private formatMoveName(name: string): string {
    return name
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }
}
