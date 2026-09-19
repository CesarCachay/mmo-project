import type { BattlePokemonState } from "@cesar-mmo/shared";

export interface ModernBattleActionMenuCallbacks {
  readonly onFightSelected: () => void;
  readonly onPokemonSelected: () => void;
  readonly onItemSelected: () => void;
  readonly onRunSelected: () => void;
}

interface BattleUiBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface BattleUiViewport {
  readonly width: number;
  readonly height: number;
}

export class ModernBattleActionMenu {
  private readonly root: HTMLDivElement;
  private readonly prompt: HTMLDivElement;

  private readonly fightButton: HTMLButtonElement;
  private readonly pokemonButton: HTMLButtonElement;
  private readonly itemButton: HTMLButtonElement;
  private readonly runButton: HTMLButtonElement;

  private readonly callbacks: ModernBattleActionMenuCallbacks;

  private enabled = true;
  private runAllowed = true;

  constructor(parent: HTMLElement, callbacks: ModernBattleActionMenuCallbacks) {
    this.callbacks = callbacks;

    this.root = document.createElement("div");
    this.root.className = "battle-action-menu";
    this.root.style.display = "none";

    this.prompt = document.createElement("div");
    this.prompt.className = "battle-action-menu__prompt";
    this.prompt.textContent = "What will your Pokémon do?";

    const actions = document.createElement("div");

    actions.className = "battle-action-menu__actions";

    this.fightButton = this.createButton(
      "FIGHT",
      ["battle-action-menu__button", "battle-action-menu__button--fight"].join(" "),
      () => {
        this.callbacks.onFightSelected();
      }
    );

    this.pokemonButton = this.createButton(
      "POKÉMON",
      ["battle-action-menu__button", "battle-action-menu__button--pokemon"].join(" "),
      () => {
        this.callbacks.onPokemonSelected();
      }
    );

    this.itemButton = this.createButton(
      "ITEM",
      ["battle-action-menu__button", "battle-action-menu__button--item"].join(" "),
      () => {
        this.callbacks.onItemSelected();
      }
    );

    this.runButton = this.createButton(
      "RUN",
      ["battle-action-menu__button", "battle-action-menu__button--run"].join(" "),
      () => {
        this.callbacks.onRunSelected();
      }
    );

    actions.append(this.fightButton, this.pokemonButton, this.itemButton, this.runButton);

    this.root.append(this.prompt, actions);

    parent.appendChild(this.root);
  }

  public setPokemon(pokemonState: BattlePokemonState): void {
    const pokemon = pokemonState.pokemon;

    const displayName = pokemon.nickname?.trim();

    this.prompt.textContent = displayName
      ? `What will ${displayName} do?`
      : "What will your Pokémon do?";
  }

  public setBounds(bounds: BattleUiBounds, viewport: BattleUiViewport): void {
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

  public setVisible(visible: boolean): void {
    this.root.style.display = visible ? "flex" : "none";
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.syncButtonState();
  }

  public setRunAvailability(allowed: boolean, reason?: string): void {
    this.runAllowed = allowed;

    if (allowed) {
      this.runButton.textContent = "RUN";
      this.runButton.removeAttribute("title");
      this.runButton.removeAttribute("aria-label");
      this.runButton.removeAttribute("data-rule-reason");
    } else {
      const message = reason?.trim() || "Run is not available in this battle.";

      this.runButton.textContent = "RUN ✕";
      this.runButton.title = message;
      this.runButton.setAttribute("aria-label", `RUN — ${message}`);
      this.runButton.dataset.ruleReason = message;
    }

    this.syncButtonState();
  }

  public clear(): void {
    this.prompt.textContent = "What will your Pokémon do?";
    this.runAllowed = true;
    this.runButton.textContent = "RUN";
    this.runButton.removeAttribute("title");
    this.runButton.removeAttribute("aria-label");
    this.runButton.removeAttribute("data-rule-reason");

    this.setEnabled(true);
    this.setVisible(false);
  }

  public destroy(): void {
    this.root.remove();
  }

  private syncButtonState(): void {
    const globallyDisabled = !this.enabled;

    this.fightButton.disabled = globallyDisabled;
    this.pokemonButton.disabled = globallyDisabled;
    this.itemButton.disabled = globallyDisabled;
    this.runButton.disabled = globallyDisabled || !this.runAllowed;
  }

  private createButton(
    label: string,
    className: string,
    onClick: () => void
  ): HTMLButtonElement {
    const button = document.createElement("button");

    button.type = "button";
    button.className = className;
    button.textContent = label;

    button.addEventListener("click", onClick);

    return button;
  }
}
