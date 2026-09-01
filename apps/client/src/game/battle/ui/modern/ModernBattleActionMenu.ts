import type { BattlePokemonState } from "@cesar-mmo/shared";

export interface ModernBattleActionMenuCallbacks {
  readonly onFightSelected: () => void;
  readonly onPokemonSelected: () => void;
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

  private readonly callbacks: ModernBattleActionMenuCallbacks;

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
      "battle-action-menu__button battle-action-menu__button--fight",
      () => {
        this.callbacks.onFightSelected();
      }
    );

    this.pokemonButton = this.createButton(
      "POKÉMON",
      "battle-action-menu__button battle-action-menu__button--pokemon",
      () => {
        this.callbacks.onPokemonSelected();
      }
    );

    actions.append(this.fightButton, this.pokemonButton);

    this.root.append(this.prompt, actions);

    parent.appendChild(this.root);
  }

  public setPokemon(pokemonState: BattlePokemonState): void {
    const pokemon = pokemonState.pokemon;

    /*
     * Por ahora usamos nickname cuando existe.
     * Si no existe, mantenemos un prompt neutro.
     *
     * Más adelante podemos reutilizar
     * getPokemonDisplayName() si queremos
     * nombre de especie exactamente igual al HUD.
     */
    const displayName = pokemon.nickname?.trim();

    this.prompt.textContent = displayName
      ? `What will ${displayName} do?`
      : "What will your Pokémon do?";
  }

  public setBounds(bounds: BattleUiBounds, viewport: BattleUiViewport): void {
    /*
     * Battle DOM root comparte las dimensiones
     * lógicas de Phaser.
     *
     * Convertimos el centro recibido por
     * BattleOverlay a left/top.
     */
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
    this.fightButton.disabled = !enabled;
    this.pokemonButton.disabled = !enabled;
  }

  public clear(): void {
    this.prompt.textContent = "What will your Pokémon do?";

    this.setEnabled(true);
    this.setVisible(false);
  }

  public destroy(): void {
    this.root.remove();
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
