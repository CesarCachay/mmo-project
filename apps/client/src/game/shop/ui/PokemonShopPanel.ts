import {
  POKEMON_SHOP_MAX_TRANSACTION_QUANTITY,
  getPokemonItem,
  getPokemonItemBuyPrice,
  getPokemonItemSellPrice,
  getPokemonShopCatalog,
  type PokemonItemId,
  type PokemonShopCatalogId,
  type PokemonShopOpenedPayload,
  type PokemonShopPurchasedPayload,
  type PokemonShopSoldPayload,
} from "@cesar-mmo/shared";

import "./pokemon-shop-ui.css";

export interface PokemonShopPanelOptions {
  readonly onBuy: (itemId: PokemonItemId, quantity: number) => void;
  readonly onSell: (itemId: PokemonItemId, quantity: number) => void;
  readonly onClose: () => void;
}

type PokemonShopPanelMode = "buy" | "sell";

type ShopControl = HTMLButtonElement | HTMLInputElement;

export class PokemonShopPanel {
  private readonly root: HTMLDivElement;
  private readonly shell: HTMLDivElement;
  private readonly title: HTMLDivElement;
  private readonly subtitle: HTMLDivElement;
  private readonly money: HTMLDivElement;
  private readonly moneyValue: HTMLSpanElement;
  private readonly catalog: HTMLDivElement;
  private readonly notice: HTMLDivElement;
  private readonly error: HTMLDivElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly buyTab: HTMLButtonElement;
  private readonly sellTab: HTMLButtonElement;
  private readonly pendingStatus: HTMLDivElement;
  private readonly pendingText: HTMLSpanElement;
  private readonly options: PokemonShopPanelOptions;

  private readonly inventoryQuantities = new Map<PokemonItemId, number>();
  private catalogId?: PokemonShopCatalogId;
  private mode: PokemonShopPanelMode = "buy";
  private currentMoney = 0;
  private pending = false;

  constructor(options: PokemonShopPanelOptions) {
    this.options = options;

    const app = document.getElementById("app");
    if (!app) {
      throw new Error('Poké Shop UI requires "#app" root element');
    }

    this.root = document.createElement("div");
    this.root.className = "pokemon-shop-ui";
    this.root.hidden = true;
    this.root.setAttribute("data-pokemon-shop-ui", "true");
    this.root.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || this.pending) {
        return;
      }

      event.preventDefault();
      this.options.onClose();
    });

    this.shell = document.createElement("div");
    this.shell.className = "pokemon-shop-ui__shell";
    this.shell.setAttribute("role", "dialog");
    this.shell.setAttribute("aria-modal", "true");
    this.shell.setAttribute("aria-labelledby", "pokemon-shop-title");
    this.shell.setAttribute("aria-describedby", "pokemon-shop-subtitle");

    const header = document.createElement("header");
    header.className = "pokemon-shop-ui__header";

    const heading = document.createElement("div");
    heading.className = "pokemon-shop-ui__heading";

    this.title = document.createElement("div");
    this.title.id = "pokemon-shop-title";
    this.title.className = "pokemon-shop-ui__title";
    this.title.textContent = "POKÉ SHOP";

    this.subtitle = document.createElement("div");
    this.subtitle.id = "pokemon-shop-subtitle";
    this.subtitle.className = "pokemon-shop-ui__subtitle";
    this.subtitle.textContent = "Selecciona un objeto y la cantidad";

    heading.append(this.title, this.subtitle);

    this.money = document.createElement("div");
    this.money.className = "pokemon-shop-ui__money";
    this.money.setAttribute("aria-label", "Saldo disponible");

    const moneyLabel = document.createElement("span");
    moneyLabel.className = "pokemon-shop-ui__money-label";
    moneyLabel.textContent = "SALDO";

    this.moneyValue = document.createElement("span");
    this.moneyValue.className = "pokemon-shop-ui__money-value";

    this.money.append(moneyLabel, this.moneyValue);
    header.append(heading, this.money);

    const tabs = document.createElement("div");
    tabs.className = "pokemon-shop-ui__tabs";
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "Modo de tienda");

    this.buyTab = this.createTab("COMPRAR", "buy");
    this.sellTab = this.createTab("VENDER", "sell");
    tabs.append(this.buyTab, this.sellTab);

    this.pendingStatus = document.createElement("div");
    this.pendingStatus.className = "pokemon-shop-ui__pending";
    this.pendingStatus.setAttribute("role", "status");
    this.pendingStatus.setAttribute("aria-live", "polite");

    const spinner = document.createElement("span");
    spinner.className = "pokemon-shop-ui__spinner";
    spinner.setAttribute("aria-hidden", "true");

    this.pendingText = document.createElement("span");
    this.pendingText.textContent = "Procesando transacción…";
    this.pendingStatus.append(spinner, this.pendingText);

    this.catalog = document.createElement("div");
    this.catalog.className = "pokemon-shop-ui__catalog";
    this.catalog.setAttribute("role", "list");

    this.notice = document.createElement("div");
    this.notice.className = "pokemon-shop-ui__notice";
    this.notice.setAttribute("role", "status");
    this.notice.setAttribute("aria-live", "polite");

    this.error = document.createElement("div");
    this.error.className = "pokemon-shop-ui__error";
    this.error.setAttribute("role", "alert");
    this.error.setAttribute("aria-live", "assertive");

    const feedback = document.createElement("div");
    feedback.className = "pokemon-shop-ui__feedback";
    feedback.append(this.pendingStatus, this.notice, this.error);

    const footer = document.createElement("footer");
    footer.className = "pokemon-shop-ui__footer";

    const hint = document.createElement("div");
    hint.className = "pokemon-shop-ui__hint";
    hint.textContent = "Las transacciones se validan y guardan en el servidor.";

    this.closeButton = document.createElement("button");
    this.closeButton.type = "button";
    this.closeButton.className = "pokemon-shop-ui__close";
    this.closeButton.textContent = "CERRAR";
    this.closeButton.dataset.shopControl = "true";
    this.closeButton.addEventListener("click", () => this.options.onClose());

    footer.append(hint, this.closeButton);
    this.shell.append(header, tabs, this.catalog, feedback, footer);
    this.root.appendChild(this.shell);
    app.appendChild(this.root);
  }

  public get isVisible(): boolean {
    return !this.root.hidden;
  }

  public show(): void {
    this.root.hidden = false;
    queueMicrotask(() => this.buyTab.focus());
  }

  public hide(): void {
    this.root.hidden = true;
    this.notice.textContent = "";
    this.error.textContent = "";
    this.inventoryQuantities.clear();
    this.catalogId = undefined;
    this.mode = "buy";
    this.currentMoney = 0;
    this.pending = false;
    this.root.removeAttribute("data-pending");
  }

  public destroy(): void {
    this.root.remove();
  }

  public setSession(payload: PokemonShopOpenedPayload): void {
    const catalog = getPokemonShopCatalog(payload.catalogId);

    this.catalogId = payload.catalogId;
    this.mode = "buy";
    this.inventoryQuantities.clear();
    for (const stack of payload.inventory.items) {
      this.inventoryQuantities.set(stack.itemId, stack.quantity);
    }

    this.title.textContent = catalog.displayName.toUpperCase();
    this.sellTab.dataset.disabledByCatalog = catalog.buysItemsFromTrainer
      ? "false"
      : "true";
    this.sellTab.disabled = !catalog.buysItemsFromTrainer;
    this.setMoney(payload.money, false);
    this.notice.textContent = "";
    this.error.textContent = "";
    this.renderCurrentMode();
    this.setPending(false);
  }

  public applyPurchase(payload: PokemonShopPurchasedPayload): void {
    const item = getPokemonItem(payload.itemId);
    this.inventoryQuantities.set(payload.itemId, payload.inventoryQuantity);
    this.setMoney(payload.money, true);
    this.error.textContent = "";
    this.renderCurrentMode();
    this.notice.textContent = `Compra completada: ${payload.quantity} × ${item.name} por ₽ ${payload.totalPrice.toLocaleString("en-US")}. Ahora tienes ${payload.inventoryQuantity}.`;
  }

  public applySale(payload: PokemonShopSoldPayload): void {
    const item = getPokemonItem(payload.itemId);

    if (payload.inventoryQuantity > 0) {
      this.inventoryQuantities.set(payload.itemId, payload.inventoryQuantity);
    } else {
      this.inventoryQuantities.delete(payload.itemId);
    }

    this.setMoney(payload.money, true);
    this.error.textContent = "";
    this.renderCurrentMode();
    this.notice.textContent = `Venta completada: ${payload.quantity} × ${item.name} por ₽ ${payload.totalPrice.toLocaleString("en-US")}. Te quedan ${payload.inventoryQuantity}.`;
  }

  public setPending(pending: boolean, message = "Procesando transacción…"): void {
    this.pending = pending;
    this.root.toggleAttribute("data-pending", pending);
    this.pendingText.textContent = message;

    this.root.querySelectorAll<ShopControl>("[data-shop-control]").forEach((control) => {
      control.disabled =
        pending ||
        control.dataset.unavailable === "true" ||
        control.dataset.disabledByCatalog === "true";
    });
  }

  public setError(message: string): void {
    this.error.textContent = message;
    if (message) {
      this.notice.textContent = "";
      this.shell.classList.remove("pokemon-shop-ui__shell--error");
      // Restart the short visual error cue without keeping animation state around.
      void this.shell.offsetWidth;
      this.shell.classList.add("pokemon-shop-ui__shell--error");
      window.setTimeout(() => {
        this.shell.classList.remove("pokemon-shop-ui__shell--error");
      }, 320);
    }
  }

  private createTab(label: string, mode: PokemonShopPanelMode): HTMLButtonElement {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "pokemon-shop-ui__tab";
    tab.textContent = label;
    tab.dataset.shopMode = mode;
    tab.dataset.shopControl = "true";
    tab.setAttribute("role", "tab");
    tab.addEventListener("click", () => {
      if (tab.disabled || this.mode === mode) {
        return;
      }

      this.mode = mode;
      this.notice.textContent = "";
      this.error.textContent = "";
      this.renderCurrentMode();
    });
    return tab;
  }

  private renderCurrentMode(): void {
    if (!this.catalogId) {
      this.catalog.replaceChildren();
      return;
    }

    const isBuy = this.mode === "buy";
    this.buyTab.classList.toggle("is-active", isBuy);
    this.sellTab.classList.toggle("is-active", !isBuy);
    this.buyTab.setAttribute("aria-selected", String(isBuy));
    this.sellTab.setAttribute("aria-selected", String(!isBuy));

    if (isBuy) {
      this.subtitle.textContent = "Compra objetos para preparar tu próxima aventura";
      this.renderBuyCatalog(this.catalogId);
      return;
    }

    this.subtitle.textContent = "Vende objetos de tu inventario y recibe dinero";
    this.renderSellInventory();
  }

  private renderBuyCatalog(catalogId: PokemonShopCatalogId): void {
    const catalog = getPokemonShopCatalog(catalogId);
    const rows = catalog.stockedItemIds.map((itemId) => {
      const item = getPokemonItem(itemId);
      const price = getPokemonItemBuyPrice(itemId);

      return this.createTransactionRow({
        itemId,
        name: item.name,
        price,
        actionLabel: "COMPRAR",
        action: "buy",
        maxQuantity: POKEMON_SHOP_MAX_TRANSACTION_QUANTITY,
        ownedQuantity: this.inventoryQuantities.get(itemId) ?? 0,
        onSubmit: (quantity) => this.options.onBuy(itemId, quantity),
      });
    });

    this.catalog.replaceChildren(...rows);
  }

  private renderSellInventory(): void {
    const rows: HTMLElement[] = [];

    for (const [itemId, ownedQuantity] of this.inventoryQuantities) {
      if (ownedQuantity <= 0) {
        continue;
      }

      const price = getPokemonItemSellPrice(itemId);
      if (price === null) {
        continue;
      }

      const item = getPokemonItem(itemId);
      rows.push(
        this.createTransactionRow({
          itemId,
          name: item.name,
          price,
          actionLabel: "VENDER",
          action: "sell",
          maxQuantity: Math.min(
            POKEMON_SHOP_MAX_TRANSACTION_QUANTITY,
            ownedQuantity,
          ),
          ownedQuantity,
          onSubmit: (quantity) => this.options.onSell(itemId, quantity),
        }),
      );
    }

    if (rows.length === 0) {
      const empty = document.createElement("div");
      empty.className = "pokemon-shop-ui__empty";
      empty.textContent = "No tienes objetos que esta tienda pueda comprar.";
      rows.push(empty);
    }

    this.catalog.replaceChildren(...rows);
  }

  private createTransactionRow(input: {
    readonly itemId: PokemonItemId;
    readonly name: string;
    readonly price: number | null;
    readonly actionLabel: string;
    readonly action: "buy" | "sell";
    readonly maxQuantity: number;
    readonly ownedQuantity: number;
    readonly onSubmit: (quantity: number) => void;
  }): HTMLDivElement {
    const row = document.createElement("div");
    row.className = "pokemon-shop-ui__item";
    row.dataset.itemId = input.itemId;
    row.setAttribute("role", "listitem");

    const itemInfo = document.createElement("div");
    itemInfo.className = "pokemon-shop-ui__item-info";

    const topLine = document.createElement("div");
    topLine.className = "pokemon-shop-ui__item-topline";

    const name = document.createElement("span");
    name.className = "pokemon-shop-ui__item-name";
    name.textContent = input.name;

    const amount = document.createElement("span");
    amount.className = "pokemon-shop-ui__item-price";
    amount.textContent =
      input.price === null
        ? "No disponible"
        : `₽ ${input.price.toLocaleString("en-US")} c/u`;

    topLine.append(name, amount);

    const detail = document.createElement("span");
    detail.className = "pokemon-shop-ui__item-owned";
    detail.textContent = `Tienes: ${input.ownedQuantity}`;

    const preview = document.createElement("span");
    preview.className = "pokemon-shop-ui__item-total";

    itemInfo.append(topLine, detail, preview);

    const controls = document.createElement("div");
    controls.className = "pokemon-shop-ui__item-controls";

    const quantityGroup = document.createElement("div");
    quantityGroup.className = "pokemon-shop-ui__quantity-group";

    const decrement = this.createQuantityButton("−", `Reducir cantidad de ${input.name}`);

    const quantity = document.createElement("input");
    quantity.className = "pokemon-shop-ui__quantity";
    quantity.type = "number";
    quantity.min = "1";
    quantity.step = "1";
    quantity.value = "1";
    quantity.inputMode = "numeric";
    quantity.dataset.shopControl = "true";
    quantity.setAttribute("aria-label", `Cantidad de ${input.name}`);

    const increment = this.createQuantityButton("+", `Aumentar cantidad de ${input.name}`);

    quantityGroup.append(decrement, quantity, increment);

    const maxButton = document.createElement("button");
    maxButton.type = "button";
    maxButton.className = "pokemon-shop-ui__max";
    maxButton.textContent = "MAX";
    maxButton.dataset.shopControl = "true";
    maxButton.setAttribute("aria-label", `Usar cantidad máxima de ${input.name}`);

    const actionButton = document.createElement("button");
    actionButton.type = "button";
    actionButton.className = `pokemon-shop-ui__action pokemon-shop-ui__${input.action}`;
    actionButton.textContent = input.actionLabel;
    actionButton.dataset.shopAction = input.action;
    actionButton.dataset.shopControl = "true";

    const calculateEffectiveMax = (): number => {
      if (input.price === null || input.price <= 0) {
        return 0;
      }

      if (input.action === "sell") {
        return input.maxQuantity;
      }

      const affordableQuantity = Math.floor(this.currentMoney / input.price);
      return Math.min(input.maxQuantity, affordableQuantity);
    };

    const update = (requestedQuantity?: number): number => {
      const effectiveMax = calculateEffectiveMax();
      const unavailable = effectiveMax < 1 || input.price === null;
      const parsed = requestedQuantity ?? Number(quantity.value);
      const safeQuantity = unavailable
        ? 1
        : Math.min(
            effectiveMax,
            Math.max(1, Number.isInteger(parsed) ? parsed : 1),
          );

      quantity.max = String(Math.max(1, effectiveMax));
      quantity.value = String(safeQuantity);

      const totalPrice = input.price === null ? 0 : input.price * safeQuantity;
      preview.textContent =
        input.price === null
          ? ""
          : input.action === "buy"
            ? `Total: ₽ ${totalPrice.toLocaleString("en-US")}`
            : `Recibes: ₽ ${totalPrice.toLocaleString("en-US")}`;

      const controlsToDisable: ShopControl[] = [
        decrement,
        quantity,
        increment,
        maxButton,
        actionButton,
      ];

      for (const control of controlsToDisable) {
        control.dataset.unavailable = unavailable ? "true" : "false";
        control.disabled = this.pending || unavailable;
      }

      row.classList.toggle("is-unavailable", unavailable);
      if (unavailable && input.action === "buy" && input.price !== null) {
        detail.textContent = `Tienes: ${input.ownedQuantity} · Saldo insuficiente`;
      } else {
        detail.textContent = `Tienes: ${input.ownedQuantity}`;
      }

      const decrementUnavailable = unavailable || safeQuantity <= 1;
      const incrementUnavailable = unavailable || safeQuantity >= effectiveMax;
      const maxUnavailable = unavailable || effectiveMax <= 1;

      decrement.dataset.unavailable = decrementUnavailable ? "true" : "false";
      increment.dataset.unavailable = incrementUnavailable ? "true" : "false";
      maxButton.dataset.unavailable = maxUnavailable ? "true" : "false";
      decrement.disabled = this.pending || decrementUnavailable;
      increment.disabled = this.pending || incrementUnavailable;
      maxButton.disabled = this.pending || maxUnavailable;

      return safeQuantity;
    };

    decrement.addEventListener("click", () => {
      update(Number(quantity.value) - 1);
    });
    increment.addEventListener("click", () => {
      update(Number(quantity.value) + 1);
    });
    maxButton.addEventListener("click", () => {
      update(calculateEffectiveMax());
    });
    quantity.addEventListener("input", () => {
      update();
    });
    quantity.addEventListener("blur", () => {
      update();
    });
    quantity.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || actionButton.disabled) {
        return;
      }
      event.preventDefault();
      actionButton.click();
    });

    actionButton.addEventListener("click", () => {
      const safeQuantity = update();
      if (!actionButton.disabled) {
        input.onSubmit(safeQuantity);
      }
    });

    controls.append(quantityGroup, maxButton, actionButton);
    row.append(itemInfo, controls);
    update(1);
    return row;
  }

  private createQuantityButton(label: string, ariaLabel: string): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pokemon-shop-ui__quantity-step";
    button.textContent = label;
    button.dataset.shopControl = "true";
    button.setAttribute("aria-label", ariaLabel);
    return button;
  }

  private setMoney(money: number, animate: boolean): void {
    const changed = this.currentMoney !== money;
    this.currentMoney = money;
    this.moneyValue.textContent = `₽ ${money.toLocaleString("en-US")}`;

    if (!animate || !changed) {
      return;
    }

    this.money.classList.remove("is-updated");
    void this.money.offsetWidth;
    this.money.classList.add("is-updated");
    window.setTimeout(() => {
      this.money.classList.remove("is-updated");
    }, 480);
  }
}
