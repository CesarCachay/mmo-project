import { getPokemonItem } from "../items/pokemon-item.registry.js";
import { getPokemonInventoryItemQuantity } from "./pokemon-inventory.js";
import type { PokemonInventory } from "./pokemon-inventory.js";
import type { BattleUseItemAction } from "../battles/pokemon-battle-command.js";
import type {
  BattleInstance,
  BattleParticipantId,
} from "../battles/pokemon-battle.types.js";
import { isBattleActive } from "../battles/pokemon-battle-lifecycle.js";
import {
  ensureBattlePokemonStatusState,
  type BattleMajorStatusCondition,
} from "../battles/pokemon-battle-status.js";
import {
  planBattleHealingItemUse,
  type BattleHealingItemPlan,
} from "./pokemon-battle-healing-item.js";

export interface BattleStatusCureItemPlan {
  readonly kind: "status-cure";
  readonly participantId: BattleParticipantId;
  readonly itemId: BattleUseItemAction["itemId"];
  readonly targetPokemonInstanceId: string;
  readonly curedMajorStatus: BattleMajorStatusCondition | null;
  readonly curedConfusion: boolean;
}

export type BattleTrainerMedicineItemPlan =
  | ({ readonly kind: "hp" } & BattleHealingItemPlan)
  | BattleStatusCureItemPlan;

export function planBattleTrainerMedicineItemUse(
  battle: BattleInstance,
  participantId: BattleParticipantId,
  action: BattleUseItemAction,
  inventory: PokemonInventory,
): BattleTrainerMedicineItemPlan {
  if (!isBattleActive(battle)) {
    throw new Error(
      `Cannot use item in battle "${battle.battleId}" because it is not active`,
    );
  }

  const participant = battle.participants.find(
    (candidate) => candidate.id === participantId,
  );

  if (!participant || participant.type !== "trainer") {
    throw new Error(
      `Battle participant "${participantId}" cannot use Trainer medicine`,
    );
  }

  const item = getPokemonItem(action.itemId);

  if (!item.battleUsable || item.battleTarget !== "trainer-pokemon") {
    throw new Error(
      `Pokémon item "${action.itemId}" is not usable as Trainer medicine`,
    );
  }

  if (getPokemonInventoryItemQuantity(inventory, action.itemId) <= 0) {
    throw new Error(
      `Trainer does not have Pokémon item "${action.itemId}" available`,
    );
  }

  if (action.target.type !== "trainer-pokemon") {
    throw new Error(
      `Pokémon item "${action.itemId}" requires a Trainer Pokémon target`,
    );
  }

  if (!item.effect) {
    throw new Error(`Pokémon item "${action.itemId}" has no usable effect`);
  }

  if (item.effect.type === "heal-hp" || item.effect.type === "revive") {
    return {
      kind: "hp",
      ...planBattleHealingItemUse(battle, participantId, action, inventory),
    };
  }

  if (item.effect.type !== "cure-status") {
    throw new Error(
      `Pokémon item "${action.itemId}" is not supported Trainer medicine`,
    );
  }

  const targetPokemonInstanceId = action.target.pokemonInstanceId;

  const target = participant.pokemon.find(
    (pokemonState) =>
      pokemonState.pokemon.instanceId === targetPokemonInstanceId,
  );

  if (!target) {
    throw new Error(
      `Pokémon "${targetPokemonInstanceId}" does not belong to Trainer participant "${participant.id}"`,
    );
  }

  if (target.currentHp <= 0) {
    throw new Error(
      `Fainted Pokémon "${target.pokemon.instanceId}" cannot use "${action.itemId}"`,
    );
  }

  const statusState = ensureBattlePokemonStatusState(target);
  const curedMajorStatus =
    statusState.major && item.effect.statuses.includes(statusState.major.type)
      ? statusState.major.type
      : null;
  const curedConfusion =
    item.effect.cureConfusion === true && statusState.confusion !== null;

  if (curedMajorStatus === null && !curedConfusion) {
    throw new Error(
      `Pokémon "${target.pokemon.instanceId}" has no status curable by "${action.itemId}"`,
    );
  }

  return {
    kind: "status-cure",
    participantId: participant.id,
    itemId: action.itemId,
    targetPokemonInstanceId,
    curedMajorStatus,
    curedConfusion,
  };
}
