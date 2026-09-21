import {
  isPokemonItemId,
  type PokemonInventory,
  type PokemonItemId,
} from "../../inventory/pokemon-inventory.js";
import { isPokemonMoney, type PokemonMoney } from "../pokemon-money.js";
import {
  isPokemonShopCatalogId,
  type PokemonShopCatalogId,
} from "./pokemon-shop.catalog.js";
import { isPokemonShopTransactionQuantity } from "./pokemon-shop-pricing.js";

export const POKEMON_SHOP_EVENTS = {
  OPEN: "pokemon:shop-open",
  OPENED: "pokemon:shop-opened",
  BUY: "pokemon:shop-buy",
  PURCHASED: "pokemon:shop-purchased",
  SELL: "pokemon:shop-sell",
  SOLD: "pokemon:shop-sold",
  CLOSE: "pokemon:shop-close",
  CLOSED: "pokemon:shop-closed",
  ERROR: "pokemon:shop-error",
} as const;

export interface PokemonShopOpenInput {
  readonly npcId: string;
}

export interface PokemonShopBuyInput {
  readonly sessionId: string;
  readonly requestId: string;
  readonly itemId: PokemonItemId;
  readonly quantity: number;
}

export interface PokemonShopSellInput {
  readonly sessionId: string;
  readonly requestId: string;
  readonly itemId: PokemonItemId;
  readonly quantity: number;
}

export interface PokemonShopCloseInput {
  readonly sessionId: string;
}

export interface PokemonShopOpenedPayload {
  readonly sessionId: string;
  readonly npcId: string;
  readonly catalogId: PokemonShopCatalogId;
  readonly money: PokemonMoney;
  readonly inventory: PokemonInventory;
}

export interface PokemonShopPurchasedPayload {
  readonly sessionId: string;
  readonly requestId: string;
  readonly itemId: PokemonItemId;
  readonly quantity: number;
  readonly unitPrice: PokemonMoney;
  readonly totalPrice: PokemonMoney;
  readonly money: PokemonMoney;
  readonly inventoryQuantity: number;
}

export interface PokemonShopSoldPayload {
  readonly sessionId: string;
  readonly requestId: string;
  readonly itemId: PokemonItemId;
  readonly quantity: number;
  readonly unitPrice: PokemonMoney;
  readonly totalPrice: PokemonMoney;
  readonly money: PokemonMoney;
  readonly inventoryQuantity: number;
}

export type PokemonShopClosedReason =
  | "client-request"
  | "disconnect"
  | "map-transition"
  | "invalidated";

export interface PokemonShopClosedPayload {
  readonly sessionId: string;
  readonly reason: PokemonShopClosedReason;
}

export type PokemonShopErrorCode =
  | "INVALID_INPUT"
  | "SHOP_NOT_AVAILABLE"
  | "INCOMPATIBLE_STATE"
  | "TRAINER_STATE_NOT_FOUND"
  | "SESSION_MISMATCH"
  | "ITEM_NOT_AVAILABLE"
  | "ITEM_NOT_SELLABLE"
  | "INSUFFICIENT_FUNDS"
  | "INSUFFICIENT_INVENTORY"
  | "WALLET_LIMIT_REACHED"
  | "PURCHASE_IN_PROGRESS"
  | "SALE_IN_PROGRESS"
  | "TRANSACTION_IN_PROGRESS"
  | "PURCHASE_FAILED"
  | "SALE_FAILED";

export interface PokemonShopErrorPayload {
  readonly code: PokemonShopErrorCode;
  readonly message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const actualKeys = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();

  return (
    actualKeys.length === expected.length &&
    actualKeys.every((key, index) => key === expected[index])
  );
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isBoundedNonEmptyString(
  value: unknown,
  maxLength: number,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= maxLength
  );
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value.trim());
}

function isPokemonInventoryPayload(value: unknown): value is PokemonInventory {
  if (!isRecord(value) || !hasExactKeys(value, ["items"]) || !Array.isArray(value.items)) {
    return false;
  }

  const seen = new Set<PokemonItemId>();

  for (const stack of value.items) {
    if (
      !isRecord(stack) ||
      !hasExactKeys(stack, ["itemId", "quantity"]) ||
      !isPokemonItemId(stack.itemId) ||
      typeof stack.quantity !== "number" ||
      !Number.isInteger(stack.quantity) ||
      stack.quantity <= 0 ||
      seen.has(stack.itemId)
    ) {
      return false;
    }

    seen.add(stack.itemId);
  }

  return true;
}

function isPokemonShopTransactionInput(
  value: unknown,
): value is PokemonShopBuyInput | PokemonShopSellInput {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["sessionId", "requestId", "itemId", "quantity"]) &&
    isUuid(value.sessionId) &&
    isUuid(value.requestId) &&
    isPokemonItemId(value.itemId) &&
    isPokemonShopTransactionQuantity(value.quantity)
  );
}

function isPokemonShopTransactionReceipt(
  value: unknown,
): value is PokemonShopPurchasedPayload | PokemonShopSoldPayload {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      "sessionId",
      "requestId",
      "itemId",
      "quantity",
      "unitPrice",
      "totalPrice",
      "money",
      "inventoryQuantity",
    ]) &&
    isUuid(value.sessionId) &&
    isUuid(value.requestId) &&
    isPokemonItemId(value.itemId) &&
    isPokemonShopTransactionQuantity(value.quantity) &&
    isPokemonMoney(value.unitPrice) &&
    isPokemonMoney(value.totalPrice) &&
    isPokemonMoney(value.money) &&
    typeof value.inventoryQuantity === "number" &&
    Number.isInteger(value.inventoryQuantity) &&
    value.inventoryQuantity >= 0
  );
}

export function isPokemonShopOpenInput(
  value: unknown,
): value is PokemonShopOpenInput {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["npcId"]) &&
    isBoundedNonEmptyString(value.npcId, 64)
  );
}

export function isPokemonShopBuyInput(
  value: unknown,
): value is PokemonShopBuyInput {
  return isPokemonShopTransactionInput(value);
}

export function isPokemonShopSellInput(
  value: unknown,
): value is PokemonShopSellInput {
  return isPokemonShopTransactionInput(value);
}

export function isPokemonShopCloseInput(
  value: unknown,
): value is PokemonShopCloseInput {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["sessionId"]) &&
    isUuid(value.sessionId)
  );
}

export function isPokemonShopOpenedPayload(
  value: unknown,
): value is PokemonShopOpenedPayload {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["sessionId", "npcId", "catalogId", "money", "inventory"]) &&
    isUuid(value.sessionId) &&
    isBoundedNonEmptyString(value.npcId, 64) &&
    isPokemonShopCatalogId(value.catalogId) &&
    isPokemonMoney(value.money) &&
    isPokemonInventoryPayload(value.inventory)
  );
}

export function isPokemonShopPurchasedPayload(
  value: unknown,
): value is PokemonShopPurchasedPayload {
  return isPokemonShopTransactionReceipt(value);
}

export function isPokemonShopSoldPayload(
  value: unknown,
): value is PokemonShopSoldPayload {
  return isPokemonShopTransactionReceipt(value);
}

export function isPokemonShopClosedReason(
  value: unknown,
): value is PokemonShopClosedReason {
  return (
    value === "client-request" ||
    value === "disconnect" ||
    value === "map-transition" ||
    value === "invalidated"
  );
}

export function isPokemonShopClosedPayload(
  value: unknown,
): value is PokemonShopClosedPayload {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["sessionId", "reason"]) &&
    isUuid(value.sessionId) &&
    isPokemonShopClosedReason(value.reason)
  );
}

export function isPokemonShopErrorCode(
  value: unknown,
): value is PokemonShopErrorCode {
  return (
    value === "INVALID_INPUT" ||
    value === "SHOP_NOT_AVAILABLE" ||
    value === "INCOMPATIBLE_STATE" ||
    value === "TRAINER_STATE_NOT_FOUND" ||
    value === "SESSION_MISMATCH" ||
    value === "ITEM_NOT_AVAILABLE" ||
    value === "ITEM_NOT_SELLABLE" ||
    value === "INSUFFICIENT_FUNDS" ||
    value === "INSUFFICIENT_INVENTORY" ||
    value === "WALLET_LIMIT_REACHED" ||
    value === "PURCHASE_IN_PROGRESS" ||
    value === "SALE_IN_PROGRESS" ||
    value === "TRANSACTION_IN_PROGRESS" ||
    value === "PURCHASE_FAILED" ||
    value === "SALE_FAILED"
  );
}

export function isPokemonShopErrorPayload(
  value: unknown,
): value is PokemonShopErrorPayload {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["code", "message"]) &&
    isPokemonShopErrorCode(value.code) &&
    isBoundedNonEmptyString(value.message, 512)
  );
}
