import { isBattlePokemonFainted } from "./pokemon-battle-faint.js";
import { isBattleActive } from "./pokemon-battle-lifecycle.js";
import {
  getBattleParticipantById,
  getOpposingBattleParticipant,
  getActiveBattlePokemon,
} from "./pokemon-battle-participant.js";
import {
  getBattleParticipantReplacementPokemonIndexes,
  isBattleParticipantDefeated,
} from "./pokemon-battle-participant-defeat.js";
import type { BattleInstance, BattleParticipantId } from "./pokemon-battle.types.js";

export type TrainerBattleContinuationOutcome =
  | { readonly type: "continue" }
  | {
      readonly type: "player-replacement-required";
      readonly replacementPokemonIndexes: readonly number[];
    }
  | {
      readonly type: "opponent-replacement-required";
      readonly replacementPokemonIndexes: readonly number[];
    }
  | { readonly type: "player-defeated" }
  | { readonly type: "opponent-defeated" };

export function resolveTrainerBattleContinuationOutcome(
  battle: BattleInstance,
  localParticipantId: BattleParticipantId,
): TrainerBattleContinuationOutcome {
  if (!isBattleActive(battle)) {
    throw new Error(
      `Cannot resolve Trainer Battle continuation for battle "${battle.battleId}" with status "${battle.status}"`,
    );
  }

  if (battle.type !== "trainer") {
    throw new Error(
      `Unsupported battle type "${battle.type}" while resolving Trainer Battle continuation`,
    );
  }

  const player = getBattleParticipantById(battle, localParticipantId);
  const opponent = getOpposingBattleParticipant(battle, localParticipantId);

  if (player.type !== "trainer" || opponent.type !== "trainer") {
    throw new Error(
      `Trainer Battle "${battle.battleId}" must contain Trainer participants on both sides`,
    );
  }

  const playerDefeated = isBattleParticipantDefeated(player);
  const opponentDefeated = isBattleParticipantDefeated(opponent);

  if (playerDefeated && opponentDefeated) {
    throw new Error(
      `Trainer Battle "${battle.battleId}" has both participants defeated; simultaneous defeat is not supported yet`,
    );
  }

  if (playerDefeated) {
    return { type: "player-defeated" };
  }

  if (opponentDefeated) {
    return { type: "opponent-defeated" };
  }

  if (isBattlePokemonFainted(getActiveBattlePokemon(player))) {
    const replacementPokemonIndexes =
      getBattleParticipantReplacementPokemonIndexes(player);

    if (replacementPokemonIndexes.length === 0) {
      throw new Error(
        `Player participant "${player.id}" requires replacement but has no usable replacement Pokémon`,
      );
    }

    return {
      type: "player-replacement-required",
      replacementPokemonIndexes,
    };
  }

  if (isBattlePokemonFainted(getActiveBattlePokemon(opponent))) {
    const replacementPokemonIndexes =
      getBattleParticipantReplacementPokemonIndexes(opponent);

    if (replacementPokemonIndexes.length === 0) {
      throw new Error(
        `Opponent participant "${opponent.id}" requires replacement but has no usable replacement Pokémon`,
      );
    }

    return {
      type: "opponent-replacement-required",
      replacementPokemonIndexes,
    };
  }

  return { type: "continue" };
}
