import type {
  PokemonItemId,
  PokemonShopBuyInput,
  PokemonShopClosedPayload,
  PokemonShopErrorCode,
  PokemonShopErrorPayload,
  PokemonShopOpenedPayload,
  PokemonShopPurchasedPayload,
  PokemonShopSellInput,
  PokemonShopSoldPayload,
} from "@cesar-mmo/shared";

import { PokemonShopPanel } from "./ui/PokemonShopPanel";

export interface PokemonShopControllerOptions {
  readonly openShop: (npcId: string) => void;
  readonly buyItem: (input: PokemonShopBuyInput) => void;
  readonly sellItem: (input: PokemonShopSellInput) => void;
  readonly closeShop: (sessionId: string) => void;
}

const SHOP_ERROR_MESSAGES: Readonly<Partial<Record<PokemonShopErrorCode, string>>> = {
  INVALID_INPUT: "La solicitud de tienda no es válida.",
  SHOP_NOT_AVAILABLE: "Esta tienda no está disponible en este momento.",
  INCOMPATIBLE_STATE: "No puedes usar la tienda en tu estado actual.",
  TRAINER_STATE_NOT_FOUND: "No se pudo cargar el estado de tu Trainer.",
  ITEM_NOT_AVAILABLE: "Ese objeto no está disponible para comprar aquí.",
  ITEM_NOT_SELLABLE: "Esta tienda no compra ese objeto.",
  INSUFFICIENT_FUNDS: "No tienes suficiente dinero para completar la compra.",
  INSUFFICIENT_INVENTORY: "No tienes suficientes unidades para completar la venta.",
  WALLET_LIMIT_REACHED: "Tu billetera no tiene espacio para recibir todo el dinero de esta venta.",
  PURCHASE_IN_PROGRESS: "Ya hay una compra en proceso.",
  SALE_IN_PROGRESS: "Ya hay una venta en proceso.",
  TRANSACTION_IN_PROGRESS: "Ya hay una transacción en proceso.",
  PURCHASE_FAILED: "No se pudo completar la compra. Inténtalo nuevamente.",
  SALE_FAILED: "No se pudo completar la venta. Inténtalo nuevamente.",
};

export class PokemonShopController {
  private readonly panel: PokemonShopPanel;
  private readonly options: PokemonShopControllerOptions;
  private opening = false;
  private transactionPending = false;
  private sessionId?: string;

  constructor(options: PokemonShopControllerOptions) {
    this.options = options;
    this.panel = new PokemonShopPanel({
      onBuy: (itemId, quantity) => this.requestBuy(itemId, quantity),
      onSell: (itemId, quantity) => this.requestSell(itemId, quantity),
      onClose: () => this.requestClose(),
    });
  }

  public get isOpen(): boolean {
    return this.sessionId !== undefined && this.panel.isVisible;
  }

  public get isBlockingGameplay(): boolean {
    return this.opening || this.isOpen;
  }

  public requestOpen(npcId: string): void {
    if (this.isBlockingGameplay) {
      return;
    }

    this.opening = true;
    this.options.openShop(npcId);
  }

  public applyOpened(payload: PokemonShopOpenedPayload): void {
    this.opening = false;
    this.transactionPending = false;
    this.sessionId = payload.sessionId;
    this.panel.setSession(payload);
    this.panel.setPending(false);
    this.panel.show();
  }

  public applyPurchased(payload: PokemonShopPurchasedPayload): void {
    if (!this.sessionId || payload.sessionId !== this.sessionId) {
      return;
    }

    this.transactionPending = false;
    this.panel.applyPurchase(payload);
    this.panel.setPending(false);
  }

  public applySold(payload: PokemonShopSoldPayload): void {
    if (!this.sessionId || payload.sessionId !== this.sessionId) {
      return;
    }

    this.transactionPending = false;
    this.panel.applySale(payload);
    this.panel.setPending(false);
  }

  public applyClosed(payload: PokemonShopClosedPayload): void {
    if (this.sessionId && payload.sessionId !== this.sessionId) {
      return;
    }

    this.dismiss();
  }

  public applyError(payload: PokemonShopErrorPayload): void {
    this.opening = false;
    this.transactionPending = false;
    this.panel.setPending(false);

    if (payload.code === "SESSION_MISMATCH") {
      this.dismiss();
      return;
    }

    if (this.panel.isVisible) {
      this.panel.setError(SHOP_ERROR_MESSAGES[payload.code] ?? payload.message);
      return;
    }

    console.warn("[PokemonShop] authoritative error", payload);
  }

  public dismiss(): void {
    this.opening = false;
    this.transactionPending = false;
    this.sessionId = undefined;
    this.panel.setPending(false);
    this.panel.hide();
  }

  public destroy(): void {
    this.panel.destroy();
  }

  private requestBuy(itemId: PokemonItemId, quantity: number): void {
    const sessionId = this.sessionId;

    if (!sessionId || this.transactionPending) {
      return;
    }

    this.transactionPending = true;
    this.panel.setPending(true, "Procesando compra…");
    this.panel.setError("");

    this.options.buyItem({
      sessionId,
      requestId: globalThis.crypto.randomUUID(),
      itemId,
      quantity,
    });
  }

  private requestSell(itemId: PokemonItemId, quantity: number): void {
    const sessionId = this.sessionId;

    if (!sessionId || this.transactionPending) {
      return;
    }

    this.transactionPending = true;
    this.panel.setPending(true, "Procesando venta…");
    this.panel.setError("");

    this.options.sellItem({
      sessionId,
      requestId: globalThis.crypto.randomUUID(),
      itemId,
      quantity,
    });
  }

  private requestClose(): void {
    const sessionId = this.sessionId;

    if (this.transactionPending) {
      return;
    }

    if (!sessionId) {
      this.dismiss();
      return;
    }

    this.options.closeShop(sessionId);
  }
}
