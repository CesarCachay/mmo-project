import {
  getPokemonItem,
  type PokemonInventory,
  type PokemonInventoryItemStack,
  type PokemonItemId,
} from "@cesar-mmo/shared";

import { getPokemonItemIconAsset } from "../items/pokemon-item-icon.registry";

import "./inventory-drawer.css";

const DRAWER_HIDE_DURATION_MS = 170;

export interface InventoryDrawerOptions {
  readonly onItemSelected?: (itemId: PokemonItemId) => void;

  readonly onCloseRequested?: () => void;
}

export class InventoryDrawer {
  private readonly root: HTMLElement;
  private readonly count: HTMLSpanElement;
  private readonly list: HTMLDivElement;
  private readonly closeButton: HTMLButtonElement;

  private readonly onItemSelected?: InventoryDrawerOptions["onItemSelected"];

  private readonly onCloseRequested?: InventoryDrawerOptions["onCloseRequested"];

  private inventory: PokemonInventory = {
    items: [],
  };

  private visible = false;
  private hideTimer?: number;
  private destroyed = false;

  constructor(options: InventoryDrawerOptions = {}) {
    const app = document.getElementById("app");

    if (!(app instanceof HTMLDivElement)) {
      throw new Error('InventoryDrawer requires "#app"');
    }

    this.onItemSelected = options.onItemSelected;

    this.onCloseRequested = options.onCloseRequested;

    this.root = document.createElement("aside");

    this.root.className = "inventory-drawer";

    this.root.hidden = true;

    this.root.setAttribute("aria-hidden", "true");

    this.root.setAttribute("aria-label", "Bag del Trainer");

    const header = document.createElement("header");

    header.className = "inventory-drawer__header";

    const heading = document.createElement("div");

    heading.className = "inventory-drawer__heading";

    this.count = document.createElement("span");

    this.count.className = "inventory-drawer__eyebrow";

    const title = document.createElement("h2");

    title.className = "inventory-drawer__title";

    title.textContent = "Bag";

    heading.append(this.count, title);

    this.closeButton = document.createElement("button");

    this.closeButton.type = "button";

    this.closeButton.className = "inventory-drawer__close";

    this.closeButton.textContent = "×";

    this.closeButton.setAttribute("aria-label", "Cerrar Bag");

    this.closeButton.addEventListener("click", () => {
      this.onCloseRequested?.();
      this.closeButton.blur();
    });

    header.append(heading, this.closeButton);

    this.list = document.createElement("div");

    this.list.className = "inventory-drawer__list";

    const footer = document.createElement("div");

    footer.className = "inventory-drawer__footer";

    footer.textContent = "[I] Cerrar  ·  [P] Equipo";

    this.root.append(header, this.list, footer);

    app.append(this.root);

    this.render();
  }

  public setInventory(inventory: PokemonInventory): void {
    this.inventory = inventory;
    this.render();
  }

  public show(): void {
    if (this.destroyed) {
      return;
    }

    if (this.hideTimer !== undefined) {
      window.clearTimeout(this.hideTimer);

      this.hideTimer = undefined;
    }

    this.visible = true;

    this.root.hidden = false;

    this.root.setAttribute("aria-hidden", "false");

    window.requestAnimationFrame(() => {
      if (!this.visible || this.destroyed) {
        return;
      }

      this.root.classList.add("inventory-drawer--open");
    });
  }

  public hide(): void {
    if (!this.visible) {
      return;
    }

    this.visible = false;

    this.root.classList.remove("inventory-drawer--open");

    this.root.setAttribute("aria-hidden", "true");

    if (this.hideTimer !== undefined) {
      window.clearTimeout(this.hideTimer);
    }

    this.hideTimer = window.setTimeout(() => {
      this.hideTimer = undefined;

      if (!this.visible) {
        this.root.hidden = true;
      }
    }, DRAWER_HIDE_DURATION_MS);
  }

  public toggle(): void {
    if (this.visible) {
      this.hide();
      return;
    }

    this.show();
  }

  public isVisible(): boolean {
    return this.visible;
  }

  public destroy(): void {
    this.destroyed = true;
    this.visible = false;

    if (this.hideTimer !== undefined) {
      window.clearTimeout(this.hideTimer);

      this.hideTimer = undefined;
    }

    this.root.remove();
  }

  private render(): void {
    this.list.replaceChildren();

    const items = this.inventory.items.filter((stack) => stack.quantity > 0);

    this.count.textContent = items.length === 1 ? "1 objeto" : `${items.length} objetos`;

    if (items.length === 0) {
      const empty = document.createElement("div");

      empty.className = "inventory-drawer__empty";

      empty.textContent = "No tienes objetos.";

      this.list.append(empty);

      return;
    }

    for (const stack of items) {
      this.list.append(this.createItem(stack));
    }
  }

  private createItem(stack: PokemonInventoryItemStack): HTMLButtonElement {
    const item = getPokemonItem(stack.itemId);

    const canSelect =
      item.overworldUsable && stack.quantity > 0 && Boolean(this.onItemSelected);

    const card = document.createElement("button");

    card.type = "button";

    card.className = "inventory-drawer__item";

    card.disabled = !canSelect;

    card.setAttribute(
      "aria-label",
      canSelect ? `Usar ${item.name}` : `${item.name}, no utilizable en el overworld`
    );

    const iconFrame = document.createElement("span");

    iconFrame.className = "inventory-drawer__icon-frame";

    const icon = document.createElement("img");

    icon.className = "inventory-drawer__icon";

    const iconAsset = getPokemonItemIconAsset(stack.itemId);

    icon.src = iconAsset.path;
    icon.alt = "";
    icon.draggable = false;
    icon.setAttribute("aria-hidden", "true");

    const fallback = document.createElement("span");

    fallback.className = "inventory-drawer__icon-fallback";

    fallback.textContent = "•";
    fallback.hidden = true;

    icon.addEventListener(
      "error",
      () => {
        icon.hidden = true;
        fallback.hidden = false;
      },
      {
        once: true,
      }
    );

    iconFrame.append(icon, fallback);

    const content = document.createElement("span");

    content.className = "inventory-drawer__item-content";

    const name = document.createElement("span");

    name.className = "inventory-drawer__item-name";

    name.textContent = item.name;

    const meta = document.createElement("span");

    meta.className = "inventory-drawer__item-meta";

    const category = document.createElement("span");

    category.className = "inventory-drawer__category";

    category.textContent = this.formatCategory(item.category);

    const state = document.createElement("span");

    state.className = "inventory-drawer__state";

    if (canSelect) {
      state.textContent = "Usar";

      state.classList.add("inventory-drawer__state--usable");
    } else if (item.battleUsable) {
      state.textContent = "Solo batalla";
    } else {
      state.textContent = "No disponible";
    }

    meta.append(category, state);

    content.append(name, meta);

    const quantity = document.createElement("span");

    quantity.className = "inventory-drawer__quantity";

    quantity.textContent = `×${stack.quantity}`;

    card.append(iconFrame, content, quantity);

    if (canSelect) {
      card.addEventListener("click", () => {
        this.onItemSelected?.(stack.itemId);
      });
    }

    return card;
  }

  private formatCategory(category: string): string {
    switch (category) {
      case "medicine":
        return "Medicina";

      case "ball":
        return "Poké Ball";

      case "battle-item":
        return "Objeto de batalla";

      case "evolution":
        return "Evolución";

      case "held-item":
        return "Objeto equipado";

      case "key-item":
        return "Objeto clave";

      default:
        return "Objeto";
    }
  }
}
