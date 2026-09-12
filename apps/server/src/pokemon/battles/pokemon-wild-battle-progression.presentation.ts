import type {
  BattlePresentationEvent,
  BattleParticipantId,
} from '@cesar-mmo/shared';

import type { ApplyPokemonWildBattleProgressionResult } from './pokemon-wild-battle-progression.service';

export interface CreatePokemonWildBattleProgressionPresentationInput {
  readonly participantId: BattleParticipantId;
  readonly result: ApplyPokemonWildBattleProgressionResult;
}

export function createPokemonWildBattleProgressionPresentationEvents(
  input: CreatePokemonWildBattleProgressionPresentationInput,
): readonly BattlePresentationEvent[] {
  const { participantId, result } = input;

  const events: BattlePresentationEvent[] = [];

  /*
   * ==========================================================
   * PHASE 1 — PARTY EXP
   * ==========================================================
   *
   * IMPORTANT:
   * Keep every experience-gained event consecutive so the
   * client presentation queue can animate Party EXP as one
   * simultaneous batch.
   */
  for (const reward of result.rewards) {
    /* Fainted / Lv100 entries have zero EXP */
    if (reward.gainedExperience <= 0) {
      continue;
    }

    events.push({
      type: 'experience-gained',
      participantId,
      pokemonInstanceId: reward.pokemonInstanceId,
      gainedExperience: reward.gainedExperience,
      previousExperience: reward.previousExperience,
      currentExperience: reward.currentExperience,
      previousLevel: reward.previousLevel,
      currentLevel: reward.currentLevel,
    });
  }

  /*
   * ==========================================================
   * PHASE 2 — LEVEL UP + AUTOMATIC MOVE LEARNING
   * ==========================================================
   *
   * These events run only after the full Party EXP batch
   * has completed.
   */
  for (const reward of result.rewards) {
    if (reward.leveledUp) {
      events.push({
        type: 'pokemon-leveled-up',
        participantId,
        pokemonInstanceId: reward.pokemonInstanceId,
        previousLevel: reward.previousLevel,
        currentLevel: reward.currentLevel,
      });
    }

    for (const moveId of reward.automaticallyLearnedMoveIds) {
      events.push({
        type: 'move-learned',
        participantId,
        pokemonInstanceId: reward.pokemonInstanceId,
        moveId,
      });
    }
  }

  /*
   * ==========================================================
   * PHASE 3 — INTERACTIVE MOVE LEARNING
   * ==========================================================
   *
   * Interactive decisions always happen after all automatic
   * progression presentation has finished.
   */
  for (const reward of result.rewards) {
    const pending = reward.pendingMoveLearning;

    if (!pending) {
      continue;
    }

    events.push({
      type: 'move-learning-required',
      participantId,
      pokemonInstanceId: reward.pokemonInstanceId,
      candidateMoveId: pending.candidateMoveId,
      candidateLearnedAtLevel: pending.candidateLearnedAtLevel,
      revision: pending.revision,
      currentMoves: pending.currentMoves,
    });
  }

  /*
   * ==========================================================
   * PHASE 4 — INTERACTIVE EVOLUTION
   * ==========================================================
   *
   * Direct Level Up Evolution reaches this phase only when
   * there is no pending interactive Move Learning for the
   * same Pokémon.
   *
   * When Move Learning exists, Evolution is generated later
   * by the Move Learning continuation flow instead.
   */
  for (const reward of result.rewards) {
    const pending = reward.pendingEvolution;

    if (!pending) {
      continue;
    }

    events.push({
      type: 'evolution-required',
      participantId,
      pokemonInstanceId: reward.pokemonInstanceId,
      sourceSpeciesId: pending.sourceSpeciesId,
      sourceFormId: pending.sourceFormId,
      targetSpeciesId: pending.targetSpeciesId,
      targetFormId: pending.targetFormId,
      triggerLevel: pending.triggerLevel,
      revision: pending.revision,
    });
  }

  return events;
}
