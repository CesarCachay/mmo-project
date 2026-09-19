import {
  evaluatePokemonBattleItemRule,
  evaluatePokemonBattleRunRule,
  type BattleInstance,
  type PokemonBattleRuleRejectionReason,
  type PokemonInventory,
  type PokemonInventoryItemStack,
} from "@cesar-mmo/shared";

export function isRunAvailableForBattle(battle: BattleInstance): boolean {
  return evaluatePokemonBattleRunRule(battle).allowed;
}

export function getBattleUsableInventoryItems(
  battle: BattleInstance,
  inventory: PokemonInventory,
): readonly PokemonInventoryItemStack[] {
  return inventory.items.filter((stack) => {
    if (stack.quantity <= 0) {
      return false;
    }

    return evaluatePokemonBattleItemRule(battle, stack.itemId).allowed;
  });
}

export function formatPokemonBattleRuleRejectionMessage(
  reason: PokemonBattleRuleRejectionReason,
): string {
  switch (reason) {
    case "run-not-allowed-in-trainer-battle":
      return "You can't run from a Trainer Battle.";

    case "capture-not-allowed-in-trainer-battle":
      return "You can't catch another Trainer's Pokémon.";

    case "item-not-battle-usable":
      return "That item can't be used in battle.";

    case "item-target-not-supported":
      return "That item can't be used here.";

    case "item-effect-not-supported":
      return "That item's battle effect isn't supported yet.";

    case "item-target-mismatch":
      return "That item can't target this Pokémon.";
  }
}
