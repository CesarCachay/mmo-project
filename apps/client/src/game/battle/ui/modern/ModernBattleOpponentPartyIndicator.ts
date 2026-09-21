import type { BattleInstance } from "@cesar-mmo/shared";

import {
  getBattleOpponentPartyIndicatorModel,
  getBattlePlayerPartyIndicatorModel,
  type BattleOpponentPartySlotState,
  type BattlePartyIndicatorPerspective,
} from "./battle-opponent-party-indicator";

export interface ModernBattleOpponentPartyIndicatorBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ModernBattleOpponentPartyIndicatorViewport {
  readonly width: number;
  readonly height: number;
}

export class ModernBattleOpponentPartyIndicator {
  private readonly perspective: BattlePartyIndicatorPerspective;
  private readonly root: HTMLDivElement;
  private readonly label: HTMLDivElement;
  private readonly balls: HTMLDivElement;

  constructor(
    parent: HTMLElement,
    perspective: BattlePartyIndicatorPerspective = "opponent",
  ) {
    this.perspective = perspective;
    this.root = document.createElement("div");
    this.root.className = [
      "battle-modern-opponent-party",
      `battle-modern-opponent-party--${perspective}`,
      "battle-ui-modern__surface",
    ].join(" ");
    this.root.hidden = true;

    this.label = document.createElement("div");
    this.label.className = "battle-modern-opponent-party__label";

    this.balls = document.createElement("div");
    this.balls.className = "battle-modern-opponent-party__balls";
    this.balls.ariaHidden = "true";

    this.root.append(this.label, this.balls);
    parent.appendChild(this.root);
  }

  public render(battle: BattleInstance, localParticipantId: string): void {
    const model =
      this.perspective === "player"
        ? getBattlePlayerPartyIndicatorModel(battle, localParticipantId)
        : getBattleOpponentPartyIndicatorModel(battle, localParticipantId);

    if (!model) {
      this.clear();
      return;
    }

    this.label.textContent =
      this.perspective === "player"
        ? `YOUR PARTY · ${model.usablePokemon}/${model.totalPokemon} READY`
        : `${model.displayName.toUpperCase()} · ${model.usablePokemon}/${model.totalPokemon} READY`;
    this.root.setAttribute(
      "aria-label",
      this.perspective === "player"
        ? `Your party has ${model.usablePokemon} of ${model.totalPokemon} Pokémon able to battle.`
        : `${model.displayName} has ${model.usablePokemon} of ${model.totalPokemon} Pokémon able to battle.`,
    );

    this.balls.replaceChildren(
      ...model.slots.map((slot, index) => this.createBall(slot, index)),
    );

    this.root.hidden = false;
  }

  public setBounds(
    bounds: ModernBattleOpponentPartyIndicatorBounds,
    viewport: ModernBattleOpponentPartyIndicatorViewport,
  ): void {
    if (viewport.width <= 0 || viewport.height <= 0) {
      return;
    }

    const width = Math.min(250, Math.max(144, bounds.width * 0.68));
    const desiredLeft = bounds.x - bounds.width / 2;
    const desiredTop = bounds.y + bounds.height * 0.31;

    const horizontalMargin = 12;
    const verticalMargin = 8;

    const left = Math.max(
      horizontalMargin,
      Math.min(
        viewport.width - width - horizontalMargin,
        desiredLeft,
      ),
    );

    const top = Math.max(
      verticalMargin,
      Math.min(viewport.height - 44, desiredTop),
    );

    this.root.style.left = `${(left / viewport.width) * 100}%`;
    this.root.style.top = `${(top / viewport.height) * 100}%`;
    this.root.style.width = `${(width / viewport.width) * 100}%`;
  }

  public clear(): void {
    this.root.hidden = true;
    this.root.removeAttribute("aria-label");
    this.label.textContent = "";
    this.balls.replaceChildren();
  }

  public destroy(): void {
    this.root.remove();
  }

  private createBall(
    state: BattleOpponentPartySlotState,
    index: number,
  ): HTMLSpanElement {
    const ball = document.createElement("span");

    ball.className = [
      "battle-modern-opponent-party__ball",
      `battle-modern-opponent-party__ball--${state}`,
    ].join(" ");

    ball.style.setProperty("--party-slot-index", `${index}`);

    return ball;
  }
}
