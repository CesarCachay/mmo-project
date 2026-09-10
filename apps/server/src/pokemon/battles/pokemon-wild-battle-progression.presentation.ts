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

    if (reward.leveledUp) {
      events.push({
        type: 'pokemon-leveled-up',
        participantId,
        pokemonInstanceId: reward.pokemonInstanceId,
        previousLevel: reward.previousLevel,
        currentLevel: reward.currentLevel,
      });
    }
  }

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

  return events;
}
