import type { DialogueId } from "../../dialogue.js";
import type { PokemonInstanceMove } from "../pokemon.types.js";

export type PokemonTrainerBattleAiProfileId = "basic";

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
  readonly aiProfileId: PokemonTrainerBattleAiProfileId;
  readonly preBattleDialogueId: DialogueId;
  readonly party: readonly PokemonTrainerBattlePokemonDefinition[];
}
