import {
  getPokemonItem,
  type PokemonInventory,
  type PokemonItemId,
} from "@cesar-mmo/shared";

import { getPokemonItemSpriteAsset } from "../../../pokemon/pokemon-item-sprite.registry";

export interface ModernBattleBagPanelCallbacks {
  readonly onItemSelected: (itemId: PokemonItemId) => void;
  readonly onBack: () => void;
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

export class ModernBattleBagPanel {
  private readonly root: HTMLDivElement;
  private readonly list: HTMLDivElement;
  private readonly backButton: HTMLButtonElement;

  private readonly itemButtons: HTMLButtonElement[] = [];
  private readonly onItemSelected: (itemId: PokemonItemId) => void;

  private enabled = true;

  constructor(parent: HTMLElement, callbacks: ModernBattleBagPanelCallbacks) {
    this.onItemSelected = callbacks.onItemSelected;

    this.root = document.createElement("div");
    this.root.className = "battle-modern-bag";
    this.root.hidden = true;

    const header = document.createElement("div");
    header.className = "battle-modern-bag__header";

    const headerLeft = document.createElement("div");
    headerLeft.className = "battle-modern-bag__header-left";

    const title = document.createElement("div");
    title.className = "battle-modern-bag__title";
    title.textContent = "Choose an Item";

    this.backButton = document.createElement("button");
    this.backButton.type = "button";
    this.backButton.className = "battle-replacement-panel__back";
    this.backButton.textContent = "BACK";

    this.backButton.addEventListener("click", () => {
      callbacks.onBack();
    });

    headerLeft.append(this.backButton, title);
    header.appendChild(headerLeft);

    this.list = document.createElement("div");
    this.list.className = "battle-modern-bag__list";

    this.root.append(header, this.list);
    parent.appendChild(this.root);
  }

  public render(inventory: PokemonInventory): void {
    this.itemButtons.length = 0;
    this.list.replaceChildren();

    const availableItems = inventory.items.filter((stack) => stack.quantity > 0);

    if (availableItems.length === 0) {
      const empty = document.createElement("div");
      empty.className = "battle-modern-bag__empty";
      empty.textContent = "No usable items.";

      this.list.appendChild(empty);
      return;
    }

    for (const stack of availableItems) {
      const definition = getPokemonItem(stack.itemId);

      if (!definition.battleUsable) {
        continue;
      }

      /* El Bag siempre usa el asset nativo de 48×48 */
      const itemAsset = getPokemonItemSpriteAsset(stack.itemId, 48);

      const card = document.createElement("button");

      card.type = "button";
      card.disabled = !this.enabled;
      card.className = "battle-modern-bag__item";

      card.addEventListener("click", () => {
        if (!this.enabled) {
          return;
        }

        this.onItemSelected(stack.itemId);
      });

      this.itemButtons.push(card);

      /* ICON */
      if (itemAsset) {
        const iconWrap = document.createElement("span");
        iconWrap.className = "battle-modern-bag__item-icon-wrap";

        const icon = document.createElement("img");
        icon.className = "battle-modern-bag__item-icon";
        icon.src = itemAsset.path;
        icon.alt = "";

        icon.ariaHidden = "true";
        icon.draggable = false;

        iconWrap.appendChild(icon);

        card.appendChild(iconWrap);
      }

      /* CONTENT */
      const content = document.createElement("span");
      content.className = "battle-modern-bag__item-content";

      const name = document.createElement("span");
      name.className = "battle-modern-bag__item-name";
      name.textContent = definition.name;

      content.appendChild(name);

      /* QUANTITY */
      const quantity = document.createElement("span");
      quantity.className = "battle-modern-bag__item-quantity";
      quantity.textContent = `×${stack.quantity}`;

      card.append(content, quantity);
      this.list.appendChild(card);
    }

    if (this.list.children.length === 0) {
      const empty = document.createElement("div");
      empty.className = "battle-modern-bag__empty";
      empty.textContent = "No usable items.";

      this.list.appendChild(empty);
    }
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
    this.root.hidden = !visible;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.backButton.disabled = !enabled;

    for (const button of this.itemButtons) {
      button.disabled = !enabled;
    }
  }

  public clear(): void {
    this.itemButtons.length = 0;
    this.list.replaceChildren();
    this.setVisible(false);
  }

  public destroy(): void {
    this.root.remove();
  }
}
