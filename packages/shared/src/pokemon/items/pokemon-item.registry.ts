import type { PokemonItemId } from "../inventory/pokemon-inventory.js";

export type PokemonItemCategory =
  "medicine" | "ball" | "battle-item" | "evolution" | "held-item" | "key-item" | "other";

export type PokemonItemBattleTarget = "trainer-pokemon" | "wild-active";

export type PokemonItemEffect =
  | {
      readonly type: "heal-hp";
      readonly mode: "fixed";
      readonly amount: number;
    }
  | {
      readonly type: "heal-hp";
      readonly mode: "full";
    }
  | {
      readonly type: "capture";
      readonly ballModifier: number;
    };

export interface PokemonItemDefinition {
  readonly id: PokemonItemId;
  readonly name: string;
  readonly category: PokemonItemCategory;

  readonly battleUsable: boolean;
  readonly battleTarget: PokemonItemBattleTarget | null;

  readonly effect: PokemonItemEffect | null;
}

export const POKEMON_ITEM_REGISTRY = {
  potion: {
    id: "potion",
    name: "Potion",
    category: "medicine",

    battleUsable: true,
    battleTarget: "trainer-pokemon",

    effect: {
      type: "heal-hp",
      mode: "fixed",
      amount: 20,
    },
  },

  "super-potion": {
    id: "super-potion",
    name: "Super Potion",
    category: "medicine",

    battleUsable: true,
    battleTarget: "trainer-pokemon",

    effect: {
      type: "heal-hp",
      mode: "fixed",
      amount: 50,
    },
  },

  "hyper-potion": {
    id: "hyper-potion",
    name: "Hyper Potion",
    category: "medicine",

    battleUsable: true,
    battleTarget: "trainer-pokemon",

    effect: {
      type: "heal-hp",
      mode: "fixed",
      amount: 200,
    },
  },

  "max-potion": {
    id: "max-potion",
    name: "Max Potion",
    category: "medicine",

    battleUsable: true,
    battleTarget: "trainer-pokemon",

    effect: {
      type: "heal-hp",
      mode: "full",
    },
  },

  "poke-ball": {
    id: "poke-ball",
    name: "Poké Ball",
    category: "ball",

    battleUsable: true,
    battleTarget: "wild-active",

    effect: {
      type: "capture",
      ballModifier: 1,
    },
  },
} satisfies Record<PokemonItemId, PokemonItemDefinition>;

export function getPokemonItem(itemId: PokemonItemId): PokemonItemDefinition {
  return POKEMON_ITEM_REGISTRY[itemId];
}
