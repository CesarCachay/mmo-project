import { getPokemonMove, type BattlePokemonState } from "@cesar-mmo/shared";

import type { BattleClientInteractionState } from "../../battle-client.types";

export interface ModernBattleMovePanelBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ModernBattleMovePanelViewport {
  width: number;
  height: number;
}

interface ModernBattleMovePanelOptions {
  onMoveSelected: (moveId: number) => void;
}

interface MoveButtonEntry {
  button: HTMLButtonElement;
  moveId: number;
  currentPp: number;
}

export class ModernBattleMovePanel {
  private readonly root: HTMLDivElement;
  private readonly title: HTMLDivElement;
  private readonly grid: HTMLDivElement;
  private readonly waitingLabel: HTMLDivElement;

  private readonly onMoveSelected: (moveId: number) => void;

  private interactionState: BattleClientInteractionState = "completed";
  private buttons: MoveButtonEntry[] = [];
  private pokemonState?: BattlePokemonState;

  constructor(parent: HTMLElement, options: ModernBattleMovePanelOptions) {
    this.onMoveSelected = options.onMoveSelected;
    this.root = document.createElement("div");
    this.root.className = ["battle-modern-moves", "battle-ui-modern__interactive"].join(
      " "
    );

    const header = document.createElement("div");

    header.className = "battle-modern-moves__header";

    this.title = document.createElement("div");

    this.title.className = "battle-modern-moves__title";

    this.title.textContent = "Choose a move";

    this.waitingLabel = document.createElement("div");

    this.waitingLabel.className = "battle-modern-moves__waiting";

    this.waitingLabel.textContent = "Waiting for opponent…";

    header.append(this.title, this.waitingLabel);

    this.grid = document.createElement("div");

    this.grid.className = "battle-modern-moves__grid";

    this.root.append(header, this.grid);

    parent.appendChild(this.root);

    this.setVisible(false);
  }

  public setBounds(
    bounds: ModernBattleMovePanelBounds,
    viewport: ModernBattleMovePanelViewport
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

  public setPokemon(state: BattlePokemonState): void {
    this.pokemonState = state;
    this.render();
  }

  public setInteractionState(state: BattleClientInteractionState): void {
    this.interactionState = state;
    this.refreshInteractionState();
  }

  public setVisible(visible: boolean): void {
    this.root.hidden = !visible;
  }

  public clear(): void {
    this.pokemonState = undefined;
    this.buttons = [];
    this.grid.replaceChildren();
    this.root.hidden = true;
    this.waitingLabel.hidden = true;
  }

  public destroy(): void {
    this.buttons = [];
    this.pokemonState = undefined;
    this.root.remove();
  }

  private render(): void {
    this.buttons = [];
    this.grid.replaceChildren();
    const state = this.pokemonState;

    if (!state) {
      return;
    }

    const moves = state.pokemon.moves.slice(0, 4);

    for (const instanceMove of moves) {
      const move = getPokemonMove(instanceMove.moveId);

      if (!move) {
        console.warn("[ModernBattleMovePanel] move not found", {
          moveId: instanceMove.moveId,
        });
        continue;
      }

      const button = document.createElement("button");

      button.type = "button";

      button.className = "battle-modern-move-card";

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

      const moveId = instanceMove.moveId;

      button.addEventListener("click", () => {
        if (this.interactionState !== "selecting-action" || instanceMove.currentPp <= 0) {
          return;
        }

        this.onMoveSelected(moveId);
      });

      this.grid.appendChild(button);

      this.buttons.push({
        button,
        moveId,
        currentPp: instanceMove.currentPp,
      });
    }

    this.refreshInteractionState();
  }

  private refreshInteractionState(): void {
    const canSelect = this.interactionState === "selecting-action";
    const waiting = this.interactionState === "waiting-for-server";
    this.waitingLabel.hidden = !waiting;
    this.root.classList.toggle("battle-modern-moves--waiting", waiting);

    for (const entry of this.buttons) {
      const hasPp = entry.currentPp > 0;
      const enabled = canSelect && hasPp;
      entry.button.disabled = !enabled;
      entry.button.classList.toggle("battle-modern-move-card--empty", !hasPp);
    }
  }

  private formatMoveName(name: string): string {
    return name
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }
}
