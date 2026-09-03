export const POKEMON_ITEM_IDS = [
  "potion",
  "super-potion",
  "hyper-potion",
  "max-potion",
  "poke-ball",
] as const;

export type PokemonItemId = (typeof POKEMON_ITEM_IDS)[number];

const POKEMON_ITEM_ID_SET: ReadonlySet<string> = new Set(POKEMON_ITEM_IDS);

export function isPokemonItemId(value: unknown): value is PokemonItemId {
  return typeof value === "string" && POKEMON_ITEM_ID_SET.has(value);
}
export interface PokemonInventoryItemStack {
  readonly itemId: PokemonItemId;
  readonly quantity: number;
}

export interface PokemonInventory {
  readonly items: readonly PokemonInventoryItemStack[];
}

export function createPokemonInventory(
  items: readonly PokemonInventoryItemStack[] = []
): PokemonInventory {
  assertValidPokemonInventoryItems(items);

  return {
    items: items.map((item) => ({ ...item })),
  };
}

export function getPokemonInventoryItemQuantity(
  inventory: PokemonInventory,
  itemId: PokemonItemId
): number {
  return inventory.items.find((item) => item.itemId === itemId)?.quantity ?? 0;
}

export function setPokemonInventoryItemQuantity(
  inventory: PokemonInventory,
  itemId: PokemonItemId,
  quantity: number
): PokemonInventory {
  assertValidQuantity(quantity);

  const existingItem = inventory.items.find((item) => item.itemId === itemId);

  if (quantity === 0) {
    return {
      items: inventory.items.filter((item) => item.itemId !== itemId),
    };
  }

  if (!existingItem) {
    return {
      items: [
        ...inventory.items,
        {
          itemId,
          quantity,
        },
      ],
    };
  }

  return {
    items: inventory.items.map((item) =>
      item.itemId === itemId
        ? {
            ...item,
            quantity,
          }
        : item
    ),
  };
}

export function addPokemonInventoryItem(
  inventory: PokemonInventory,
  itemId: PokemonItemId,
  quantity: number
): PokemonInventory {
  assertPositiveQuantity(quantity);

  const currentQuantity = getPokemonInventoryItemQuantity(inventory, itemId);

  return setPokemonInventoryItemQuantity(inventory, itemId, currentQuantity + quantity);
}

export function consumePokemonInventoryItem(
  inventory: PokemonInventory,
  itemId: PokemonItemId,
  quantity: number = 1
): PokemonInventory {
  assertPositiveQuantity(quantity);

  const currentQuantity = getPokemonInventoryItemQuantity(inventory, itemId);

  if (currentQuantity < quantity) {
    throw new Error(
      `Not enough "${itemId}" in inventory: requested ${quantity}, available ${currentQuantity}`
    );
  }

  return setPokemonInventoryItemQuantity(inventory, itemId, currentQuantity - quantity);
}

function assertValidPokemonInventoryItems(
  items: readonly PokemonInventoryItemStack[]
): void {
  const seenItemIds = new Set<PokemonItemId>();

  for (const item of items) {
    assertPositiveQuantity(item.quantity);

    if (seenItemIds.has(item.itemId)) {
      throw new Error(`Duplicate Pokémon inventory item "${item.itemId}"`);
    }

    seenItemIds.add(item.itemId);
  }
}

function assertValidQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error(
      `Pokémon inventory quantity must be a non-negative integer, received "${quantity}"`
    );
  }
}

function assertPositiveQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error(
      `Pokémon inventory quantity must be a positive integer, received "${quantity}"`
    );
  }
}
