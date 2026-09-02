import { calculatePokemonMaxHp } from "../pokemon-stat.js";
import { getPokemonInventoryItemQuantity } from "./pokemon-inventory.js";
import { getPokemonItem } from "../items/pokemon-item.registry.js";
import { isBattleActive } from "../battles/pokemon-battle-lifecycle.js";
import {
  BattleInstance,
  BattleParticipantId,
  BattlePokemonState,
} from "../battles/pokemon-battle.types.js";
import { BattleUseItemAction } from "../battles/pokemon-battle-command.js";
import { PokemonInventory } from "./pokemon-inventory.js";

export interface BattleHealingItemPlan {
  readonly participantId: BattleParticipantId;

  readonly itemId: BattleUseItemAction["itemId"];

  readonly targetPokemonInstanceId: string;

  readonly previousHp: number;
  readonly currentHp: number;
  readonly maxHp: number;

  readonly requestedHealing: number;
  readonly appliedHealing: number;
}

export function planBattleHealingItemUse(
  battle: BattleInstance,
  participantId: BattleParticipantId,
  action: BattleUseItemAction,
  inventory: PokemonInventory
): BattleHealingItemPlan {
  if (!isBattleActive(battle)) {
    throw new Error(
      `Cannot use item in battle "${battle.battleId}" because it is not active`
    );
  }

  const participant = battle.participants.find(
    (candidate) => candidate.id === participantId
  );

  if (!participant) {
    throw new Error(
      `Battle participant "${participantId}" not found in battle "${battle.battleId}"`
    );
  }

  if (participant.type !== "trainer") {
    throw new Error(`Battle participant "${participantId}" cannot use Trainer items`);
  }

  const item = getPokemonItem(action.itemId);

  if (!item.battleUsable) {
    throw new Error(`Pokémon item "${action.itemId}" cannot be used in battle`);
  }

  if (item.battleTarget !== "trainer-pokemon") {
    throw new Error(
      `Pokémon item "${action.itemId}" does not support Trainer Pokémon targets`
    );
  }

  if (getPokemonInventoryItemQuantity(inventory, action.itemId) <= 0) {
    throw new Error(`Trainer does not have Pokémon item "${action.itemId}" available`);
  }

  const target = participant.pokemon.find(
    (pokemonState) => pokemonState.pokemon.instanceId === action.targetPokemonInstanceId
  );

  if (!target) {
    throw new Error(
      `Pokémon "${action.targetPokemonInstanceId}" does not belong to Trainer participant "${participant.id}" in battle "${battle.battleId}"`
    );
  }

  return createHealingPlan(participant.id, action, target, item.effect);
}

function createHealingPlan(
  participantId: BattleParticipantId,
  action: BattleUseItemAction,
  target: BattlePokemonState,
  effect: ReturnType<typeof getPokemonItem>["effect"]
): BattleHealingItemPlan {
  if (!effect || effect.type !== "heal-hp") {
    throw new Error(
      `Pokémon item "${action.itemId}" does not provide an HP healing effect`
    );
  }

  if (target.currentHp <= 0) {
    throw new Error(
      `Fainted Pokémon "${target.pokemon.instanceId}" cannot be healed with "${action.itemId}"`
    );
  }

  const maxHp = calculatePokemonMaxHp(target.pokemon);

  const previousHp = target.currentHp;

  if (previousHp >= maxHp) {
    throw new Error(`Pokémon "${target.pokemon.instanceId}" already has full HP`);
  }

  const requestedHealing = effect.mode === "full" ? maxHp - previousHp : effect.amount;

  const currentHp = Math.min(maxHp, previousHp + requestedHealing);

  const appliedHealing = currentHp - previousHp;

  if (appliedHealing <= 0) {
    throw new Error(`Pokémon item "${action.itemId}" would not restore any HP`);
  }

  return {
    participantId,
    itemId: action.itemId,
    targetPokemonInstanceId: target.pokemon.instanceId,
    previousHp,
    currentHp,
    maxHp,
    requestedHealing,
    appliedHealing,
  };
}
