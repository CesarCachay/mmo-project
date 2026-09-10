import { Injectable } from '@nestjs/common';

import type {
  PokemonPartyExperienceReward,
  PokemonTrainerState,
  PokemonInstanceMove,
} from '@cesar-mmo/shared';

import { PokemonProgressionManager } from '../progression/pokemon-progression.manager';

import type { PokemonAppliedPartyProgression } from '../progression/pokemon-party-progression.service';

import { planPokemonWildBattleExperience } from './pokemon-wild-battle-experience.runtime';

import type { PokemonBattleSession } from './pokemon-battle-session';

import { toPendingMoveLearningCandidate } from '../progression/pokemon-pending-move-learning.types';

export interface PokemonWildBattleAppliedExperience {
  readonly pokemonInstanceId: string;
  readonly participated: boolean;
  readonly reason: PokemonPartyExperienceReward['reason'];
  readonly gainedExperience: number;
  readonly previousExperience: number;
  readonly currentExperience: number;
  readonly previousLevel: number;
  readonly currentLevel: number;
  readonly leveledUp: boolean;
  readonly requiresMoveLearningDecision: boolean;
  readonly pendingMoveLearning: {
    readonly candidateMoveId: number;
    readonly candidateLearnedAtLevel: number;
    readonly revision: number;
    readonly currentMoves: readonly PokemonInstanceMove[];
  } | null;
}

export interface ApplyPokemonWildBattleProgressionResult {
  readonly battleId: string;
  readonly trainerState: PokemonTrainerState;
  readonly baseExperienceReward: number;
  readonly rewards: readonly PokemonWildBattleAppliedExperience[];
}

@Injectable()
export class PokemonWildBattleProgressionService {
  constructor(private readonly progressionManager: PokemonProgressionManager) {}

  public async applyVictoryExperience(
    session: PokemonBattleSession,
  ): Promise<ApplyPokemonWildBattleProgressionResult> {
    /*
     * ------------------------------------------------------
     * 1. Calculate authoritative Battle reward
     * ------------------------------------------------------
     */
    const plan = planPokemonWildBattleExperience(session);

    /*
     * ------------------------------------------------------
     * 2. Apply Party progression atomically
     * ------------------------------------------------------
     */

    const progressionResult =
      await this.progressionManager.applyPartyExperience({
        trainerId: plan.trainerId,
        rewards: plan.distribution.rewards.map((reward) => ({
          pokemonInstanceId: reward.pokemonInstanceId,
          gainedExperience: reward.gainedExperience,
        })),
      });

    const trainerParticipant = session.battle.participants.find(
      (participant) => participant.id === plan.trainerParticipantId,
    );

    if (!trainerParticipant) {
      throw new Error(
        `Trainer Battle participant "${plan.trainerParticipantId}" missing during Wild Battle progression`,
      );
    }

    /*
     * ------------------------------------------------------
     * 3. Build presentation-friendly server result
     * ------------------------------------------------------
     */

    const progressionByPokemonId = new Map<
      string,
      PokemonAppliedPartyProgression
    >(
      progressionResult.progressions.map((progression) => [
        progression.pokemonInstanceId,

        progression,
      ]),
    );

    const rewards = plan.distribution.rewards.map(
      (reward): PokemonWildBattleAppliedExperience => {
        const appliedProgression = progressionByPokemonId.get(
          reward.pokemonInstanceId,
        );

        const previousPokemonState = trainerParticipant.pokemon.find(
          (pokemonState) =>
            pokemonState.pokemon.instanceId === reward.pokemonInstanceId,
        );

        const currentPokemon =
          progressionResult.trainerState.party.pokemon.find(
            (pokemon) => pokemon.instanceId === reward.pokemonInstanceId,
          );

        if (!previousPokemonState || !currentPokemon) {
          throw new Error(
            [
              `Pokémon "${reward.pokemonInstanceId}"`,
              'missing while building',
              'Wild Battle progression result',
            ].join(' '),
          );
        }

        if (!appliedProgression) {
          return {
            pokemonInstanceId: reward.pokemonInstanceId,
            participated: reward.participated,
            reason: reward.reason,
            gainedExperience: reward.gainedExperience,
            previousExperience: previousPokemonState.pokemon.experience,
            currentExperience: currentPokemon.experience,
            previousLevel: previousPokemonState.pokemon.level,
            currentLevel: currentPokemon.level,
            leveledUp:
              currentPokemon.level > previousPokemonState.pokemon.level,
            requiresMoveLearningDecision: false,
            pendingMoveLearning: null,
          };
        }

        const progression = appliedProgression.progression;
        const pendingCandidate =
          progression.moveLearning.status === 'pending-decision'
            ? toPendingMoveLearningCandidate(
                progression.moveLearning.pendingDecision.candidate,
              )
            : null;

        return {
          pokemonInstanceId: reward.pokemonInstanceId,
          participated: reward.participated,
          reason: reward.reason,
          gainedExperience: reward.gainedExperience,
          previousExperience: previousPokemonState.pokemon.experience,
          currentExperience: currentPokemon.experience,
          previousLevel: progression.experience.previousLevel,
          currentLevel: progression.experience.currentLevel,
          leveledUp:
            progression.experience.currentLevel >
            progression.experience.previousLevel,
          requiresMoveLearningDecision: pendingCandidate !== null,
          pendingMoveLearning: pendingCandidate
            ? {
                candidateMoveId: pendingCandidate.moveId,
                candidateLearnedAtLevel: pendingCandidate.learnedAtLevel,
                revision: 0,
                currentMoves: progression.automaticPokemonState.moves.map(
                  (move) => ({
                    ...move,
                  }),
                ),
              }
            : null,
        };
      },
    );

    return {
      battleId: plan.battleId,
      trainerState: progressionResult.trainerState,
      baseExperienceReward: plan.baseExperienceReward,
      rewards,
    };
  }
}
