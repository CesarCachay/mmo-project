import { isBattlePokemonFainted } from "./pokemon-battle-faint.js";

import { isBattleActive } from "./pokemon-battle-lifecycle.js";

import { getActiveBattlePokemon } from "./pokemon-battle-participant.js";

import {
  getBattleParticipantReplacementPokemonIndexes,
  isBattleParticipantDefeated,
} from "./pokemon-battle-participant-defeat.js";

import type { BattleInstance, BattleParticipant } from "./pokemon-battle.types.js";

export type WildBattleContinuationOutcome =
  | {
      readonly type: "continue";
    }
  | {
      readonly type: "trainer-replacement-required";
      readonly replacementPokemonIndexes: readonly number[];
    }
  | {
      readonly type: "trainer-defeated";
    }
  | {
      readonly type: "wild-defeated";
    };

export function resolveWildBattleContinuationOutcome(
  battle: BattleInstance
): WildBattleContinuationOutcome {
  //
  // 1. Continuation only makes sense
  // while Battle is active.
  //

  if (!isBattleActive(battle)) {
    throw new Error(
      `Cannot resolve continuation for battle "${battle.battleId}" with status "${battle.status}"`
    );
  }

  if (battle.type !== "wild") {
    throw new Error(
      `Unsupported battle type "${battle.type}" while resolving Wild Battle continuation`
    );
  }

  //
  // 2. Resolve current Trainer / Wild
  // participants authoritatively.
  //

  const trainer = getSingleParticipantByType(battle, "trainer");

  const wild = getSingleParticipantByType(battle, "wild");

  //
  // Current Wild Battle invariant:
  // exactly one Wild Pokémon.
  //

  if (wild.pokemon.length !== 1) {
    throw new Error(`Wild participant "${wild.id}" must contain exactly one Pokémon`);
  }

  //
  // 3. Determine full-roster defeat.
  //

  const trainerDefeated = isBattleParticipantDefeated(trainer);

  const wildDefeated = isBattleParticipantDefeated(wild);

  //
  // Current mechanics cannot legitimately
  // produce simultaneous defeat because
  // recoil / self-KO mechanics do not exist.
  //
  // Do not silently choose a winner.
  //

  if (trainerDefeated && wildDefeated) {
    throw new Error(
      `Battle "${battle.battleId}" has both participants defeated; simultaneous defeat is not supported yet`
    );
  }

  if (trainerDefeated) {
    return {
      type: "trainer-defeated",
    };
  }

  if (wildDefeated) {
    return {
      type: "wild-defeated",
    };
  }

  //
  // 4. Trainer is not defeated,
  // but active Pokémon may have fainted.
  //

  const trainerActivePokemon = getActiveBattlePokemon(trainer);

  if (isBattlePokemonFainted(trainerActivePokemon)) {
    const replacementPokemonIndexes =
      getBattleParticipantReplacementPokemonIndexes(trainer);

    if (replacementPokemonIndexes.length === 0) {
      throw new Error(
        `Trainer participant "${trainer.id}" requires replacement but has no usable replacement Pokémon`
      );
    }

    return {
      type: "trainer-replacement-required",

      replacementPokemonIndexes,
    };
  }

  //
  // 5. Nobody defeated,
  // Trainer active Pokémon can continue.
  //

  return {
    type: "continue",
  };
}

function getSingleParticipantByType(
  battle: BattleInstance,
  type: "trainer" | "wild"
): BattleParticipant {
  const participants = battle.participants.filter(
    (participant) => participant.type === type
  );

  if (participants.length !== 1) {
    throw new Error(
      `Battle "${battle.battleId}" must have exactly one "${type}" participant`
    );
  }

  const participant = participants[0];

  if (!participant) {
    throw new Error(
      `Battle participant "${type}" not found in battle "${battle.battleId}"`
    );
  }

  return participant;
}
