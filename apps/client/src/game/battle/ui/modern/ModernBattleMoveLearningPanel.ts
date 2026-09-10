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

  private readonly header: HTMLDivElement;
  private readonly title: HTMLDivElement;
  private readonly subtitle: HTMLDivElement;

  private readonly candidateCard: HTMLDivElement;

  private readonly actions: HTMLDivElement;
  private readonly grid: HTMLDivElement;

  private readonly backButton: HTMLButtonElement;

  private resolver?: (decision: PokemonMoveLearningDecision) => void;

  private currentPrompt?: MoveLearningPrompt;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");

    this.root.className = [
      "battle-modern-move-learning",
      "battle-ui-modern__interactive",
    ].join(" ");

    this.header = document.createElement("div");
    this.header.className = "battle-modern-move-learning__header";

    this.title = document.createElement("div");
    this.title.className = "battle-modern-move-learning__title";

    this.subtitle = document.createElement("div");
    this.subtitle.className = "battle-modern-move-learning__subtitle";

    this.header.append(this.title, this.subtitle);

    this.candidateCard = document.createElement("div");
    this.candidateCard.className = "battle-modern-move-learning__candidate";

    this.actions = document.createElement("div");
    this.actions.className = "battle-modern-move-learning__actions";

    this.grid = document.createElement("div");
    this.grid.className = "battle-modern-move-learning__moves";

    this.backButton = document.createElement("button");
    this.backButton.type = "button";
    this.backButton.className = "battle-move-learning__back";
    this.backButton.textContent = "BACK";

    this.backButton.addEventListener("click", () => {
      if (!this.currentPrompt) {
        return;
      }

      this.renderDecision(this.currentPrompt);
    });

    this.root.append(
      this.header,
      this.candidateCard,
      this.actions,
      this.grid,
      this.backButton,
    );

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
    this.currentPrompt = input;

    this.setWaiting(false);
    this.renderDecision(input);
    this.setVisible(true);

    return new Promise((resolve) => {
      this.resolver = resolve;
    });
  }

  public setWaiting(waiting: boolean): void {
    this.root.classList.toggle("battle-modern-move-learning--waiting", waiting);

    for (const button of this.root.querySelectorAll("button")) {
      button.disabled = waiting;
    }
  }

  public setVisible(visible: boolean): void {
    this.root.hidden = !visible;
  }

  public clear(): void {
    this.resolver = undefined;
    this.currentPrompt = undefined;

    this.candidateCard.replaceChildren();
    this.actions.replaceChildren();
    this.grid.replaceChildren();

    this.root.hidden = true;
  }

  public destroy(): void {
    this.resolver = undefined;
    this.currentPrompt = undefined;

    this.root.remove();
  }

  private renderDecision(input: MoveLearningPrompt): void {
    this.actions.replaceChildren();
    this.grid.replaceChildren();

    this.grid.hidden = true;
    this.actions.hidden = false;
    this.candidateCard.hidden = false;
    this.backButton.hidden = true;

    const candidate = getPokemonMove(input.candidateMoveId);

    const candidateName = candidate
      ? this.formatMoveName(candidate.name)
      : `Move ${input.candidateMoveId}`;

    this.title.textContent = `${input.pokemonName} wants to learn ${candidateName}!`;

    this.subtitle.textContent = "Would you like to learn this move?";

    this.renderCandidateMove(input.candidateMoveId);

    const learnButton = document.createElement("button");

    learnButton.type = "button";
    learnButton.className = [
      "battle-modern-move-learning__action",
      "battle-modern-move-learning__action--learn",
    ].join(" ");

    learnButton.textContent = "LEARN MOVE";

    learnButton.addEventListener("click", () => {
      if (!this.currentPrompt) {
        return;
      }

      this.renderForgetSelection(this.currentPrompt);
    });

    const cancelButton = document.createElement("button");

    cancelButton.type = "button";
    cancelButton.className = [
      "battle-modern-move-learning__action",
      "battle-modern-move-learning__action--cancel",
    ].join(" ");

    cancelButton.textContent = "DON'T LEARN";

    cancelButton.addEventListener("click", () => {
      this.resolve({
        type: "cancel",
      });
    });

    this.actions.append(learnButton, cancelButton);
  }

  private renderForgetSelection(input: MoveLearningPrompt): void {
    this.actions.replaceChildren();
    this.grid.replaceChildren();

    this.actions.hidden = true;
    this.candidateCard.hidden = true;
    this.grid.hidden = false;
    this.backButton.hidden = false;

    const candidate = getPokemonMove(input.candidateMoveId);

    const candidateName = candidate
      ? this.formatMoveName(candidate.name)
      : `Move ${input.candidateMoveId}`;

    this.title.textContent = "Choose a move to forget";

    this.subtitle.textContent = `${input.pokemonName} will learn ${candidateName} in its place.`;

    for (const instanceMove of input.currentMoves) {
      const button = this.createMoveButton(instanceMove);

      button.addEventListener("click", () => {
        this.resolve({
          type: "forget",
          moveId: instanceMove.moveId,
        });
      });

      this.grid.appendChild(button);
    }
  }

  private renderCandidateMove(moveId: number): void {
    this.candidateCard.replaceChildren();

    const move = getPokemonMove(moveId);

    const info = document.createElement("div");
    info.className = "battle-modern-move-learning__candidate-info";

    const name = document.createElement("span");
    name.className = "battle-modern-move-learning__candidate-name";

    name.textContent = move ? this.formatMoveName(move.name) : `Move ${moveId}`;

    info.appendChild(name);

    if (move) {
      const type = String(move.type).trim().toLowerCase();

      const typeBadge = document.createElement("span");

      typeBadge.className = [
        "battle-modern-move-card__type",
        `battle-modern-move-card__type--${type}`,
      ].join(" ");

      typeBadge.textContent = type.toUpperCase();

      info.appendChild(typeBadge);
    }

    const pp = document.createElement("span");
    pp.className = "battle-modern-move-learning__candidate-pp";

    pp.textContent = move ? `PP ${move.pp ?? 0}` : "PP —";

    this.candidateCard.append(info, pp);
  }

  private createMoveButton(
    instanceMove: PokemonInstanceMove,
  ): HTMLButtonElement {
    const move = getPokemonMove(instanceMove.moveId);

    const button = document.createElement("button");

    button.type = "button";
    button.className = "battle-modern-move-card";

    if (!move) {
      button.textContent = `Move ${instanceMove.moveId} · PP ${instanceMove.currentPp}`;

      return button;
    }

    const type = String(move.type).trim().toLowerCase();

    button.dataset.type = type;

    const top = document.createElement("div");
    top.className = "battle-modern-move-card__top";

    const name = document.createElement("span");
    name.className = "battle-modern-move-card__name";
    name.textContent = this.formatMoveName(move.name);

    const typeBadge = document.createElement("span");

    typeBadge.className = [
      "battle-modern-move-card__type",
      `battle-modern-move-card__type--${type}`,
    ].join(" ");

    typeBadge.textContent = type.toUpperCase();

    top.append(name, typeBadge);

    const bottom = document.createElement("div");
    bottom.className = "battle-modern-move-card__bottom";

    const ppLabel = document.createElement("span");
    ppLabel.className = "battle-modern-move-card__pp-label";
    ppLabel.textContent = "PP";

    const pp = document.createElement("span");
    pp.className = "battle-modern-move-card__pp";

    const maxPp = move.pp ?? 0;
    pp.textContent = `${instanceMove.currentPp} / ${maxPp}`;

    bottom.append(ppLabel, pp);
    button.append(top, bottom);

    return button;
  }

  private resolve(decision: PokemonMoveLearningDecision): void {
    const resolver = this.resolver;

    if (!resolver) {
      return;
    }

    /* Bloqueamos inmediatamente la UI antes del ACK para evitar double-submit. */
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
