import type { DialogueId } from "../../dialogue.js";
import type { PokemonInstanceMove } from "../pokemon.types.js";
import type { PokemonInventoryItemStack } from "../inventory/pokemon-inventory.js";
import type { PokemonMoney } from "../economy/pokemon-money.js";
import type {
  PokemonGymBadgeId,
  PokemonGymId,
  PokemonGymLeaderPresentationId,
} from "./pokemon-gym.types.js";

export type PokemonTrainerBattleAiProfileId = "basic";
export type PokemonTrainerBattleCategory = "standard" | "gym-leader";

export interface PokemonGymLeaderBattleMetadata {
  readonly gymId: PokemonGymId;
  readonly badgeId: PokemonGymBadgeId;
  readonly leaderPresentationId: PokemonGymLeaderPresentationId;
}

export interface PokemonTrainerBattlePokemonDefinition {
  readonly speciesId: number;
  readonly level: number;
  readonly moveIds: readonly PokemonInstanceMove["moveId"][];
}

export interface PokemonTrainerBattleDefinition {
  readonly id: string;
  readonly displayName: string;
  readonly trainerClass: string;
  readonly appearanceId: string;
  readonly category: PokemonTrainerBattleCategory;
  readonly gymLeader?: PokemonGymLeaderBattleMetadata;
  readonly aiProfileId: PokemonTrainerBattleAiProfileId;
  readonly preBattleDialogueId: DialogueId;
  readonly postBattleDialogueId: DialogueId;
  readonly rewardItems: readonly PokemonInventoryItemStack[];
  readonly rewardMoney: PokemonMoney;
  readonly party: readonly PokemonTrainerBattlePokemonDefinition[];
}
