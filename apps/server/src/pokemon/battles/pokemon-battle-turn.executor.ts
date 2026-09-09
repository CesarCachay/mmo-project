import {
  createBattleMoveExecutionContext,
  resolveBattleMoveAccuracy,
  consumeBattleMovePp,
  applyBattleMoveDamage,
  calculateBattleMoveDamage,
  evaluateBattleMoveExecutionEligibility,
} from '@cesar-mmo/shared';

import type {
  BattlePresentationEvent,
  BattleTurnResolutionEntry,
  PokemonTrainerState,
} from '@cesar-mmo/shared';

import type { PokemonBattleSession } from './pokemon-battle-session';

import { applyPokemonTrainerBattleSwitch } from './pokemon-trainer-battle-switch.runtime';

import { resolvePokemonWildBattleRun } from './run/pokemon-wild-battle-run.runtime';

import { executePokemonWildBattleCapture } from './capture/pokemon-wild-battle-capture.runtime';

import { applyPokemonTrainerBattleHealingItem } from '../items/pokemon-trainer-battle-healing-item.runtime';

import { PokemonTrainerStateStore } from '../pokemon-trainer-state.store';

import { PokemonTrainerService } from '../pokemon-trainer.service';

import { PokemonCaptureService } from './capture/pokemon-capture.service';

export type BattleTurnTerminalOutcome = 'trainer-escaped' | 'wild-captured';

export interface BattleTurnEntryExecutionResult {
  readonly events: readonly BattlePresentationEvent[];
  readonly terminalOutcome: BattleTurnTerminalOutcome | null;
  readonly trainerStateUpdate?: PokemonTrainerState;
}

export interface PokemonBattleTurnExecutorOptions {
  readonly trainerStateStore: PokemonTrainerStateStore;
  readonly trainerService: PokemonTrainerService;
  readonly captureService: PokemonCaptureService;
  readonly random?: () => number;
}

export class PokemonBattleTurnExecutor {
  private readonly trainerStateStore: PokemonTrainerStateStore;
  private readonly trainerService: PokemonTrainerService;
  private readonly captureService: PokemonCaptureService;
  private readonly random: () => number;

  constructor(options: PokemonBattleTurnExecutorOptions) {
    this.trainerStateStore = options.trainerStateStore;
    this.trainerService = options.trainerService;
    this.captureService = options.captureService;
    this.random = options.random ?? Math.random;
  }

  public async execute(
    session: PokemonBattleSession,
    entry: BattleTurnResolutionEntry,
    playerId: string,
  ): Promise<BattleTurnEntryExecutionResult> {
    switch (entry.command.action.type) {
      case 'switch-pokemon': {
        const result = applyPokemonTrainerBattleSwitch({
          session,
          entry,
        });

        return {
          events: [
            {
              type: 'pokemon-switched',
              participantId: result.participantId,
              previousActivePokemonIndex: result.previousActivePokemonIndex,
              currentActivePokemonIndex: result.currentActivePokemonIndex,
              previousPokemonInstanceId: result.previousPokemonInstanceId,
              currentPokemonInstanceId: result.activePokemonInstanceId,
            },
          ],

          terminalOutcome: null,
        };
      }

      case 'run': {
        const result = resolvePokemonWildBattleRun({
          session,
          entry,
          random: this.random,
        });

        if (result.type === 'run-succeeded') {
          return {
            events: [
              {
                type: 'run-succeeded',
                participantId: entry.command.participantId,
              },
            ],

            terminalOutcome: result.terminalOutcome,
          };
        }

        return {
          events: [
            {
              type: 'run-failed',
              participantId: entry.command.participantId,
            },
          ],

          terminalOutcome: null,
        };
      }

      case 'use-item': {
        if (entry.command.action.target.type === 'wild-active') {
          const result = await executePokemonWildBattleCapture({
            session,
            entry,
            playerId,
            trainerStateStore: this.trainerStateStore,
            trainerService: this.trainerService,
            captureService: this.captureService,
            random: this.random,
          });

          const wildParticipant = session.battle.participants.find(
            (participant) => participant.type === 'wild',
          );

          if (!wildParticipant) {
            throw new Error(
              `Wild participant not found in battle "${session.battle.battleId}"`,
            );
          }

          const wildPokemonState =
            wildParticipant.pokemon[wildParticipant.activePokemonIndex];

          if (!wildPokemonState) {
            throw new Error(
              `Wild active Pokémon not found in battle "${session.battle.battleId}"`,
            );
          }

          const itemUsedEvent: BattlePresentationEvent = {
            type: 'item-used',
            participantId: entry.command.participantId,
            itemId: entry.command.action.itemId,
            targetPokemonInstanceId: wildPokemonState.pokemon.instanceId,
          };

          if (result.type === 'capture-failed') {
            return {
              events: [
                itemUsedEvent,
                {
                  type: 'capture-failed',
                  participantId: entry.command.participantId,
                  wildParticipantId: wildParticipant.id,
                  pokemonInstanceId: wildPokemonState.pokemon.instanceId,
                  itemId: entry.command.action.itemId,
                  shakeCount: result.shakeCount,
                },
              ],
              terminalOutcome: null,
              trainerStateUpdate: result.trainerState,
            };
          }

          return {
            events: [
              itemUsedEvent,
              {
                type: 'capture-succeeded',
                participantId: entry.command.participantId,
                wildParticipantId: wildParticipant.id,
                pokemonInstanceId: wildPokemonState.pokemon.instanceId,
                itemId: entry.command.action.itemId,
                shakeCount: result.shakeCount,
              },
            ],

            terminalOutcome: result.terminalOutcome,
            trainerStateUpdate: result.trainerState,
          };
        }

        const result = await applyPokemonTrainerBattleHealingItem({
          session,
          entry,
          playerId,
          trainerStateStore: this.trainerStateStore,
          trainerService: this.trainerService,
        });

        const itemUsedEvent: BattlePresentationEvent = {
          type: 'item-used',
          participantId: result.participantId,
          itemId: result.itemId,
          targetPokemonInstanceId: result.targetPokemonInstanceId,
        };

        const hpRestoredEvent: BattlePresentationEvent = {
          type: 'hp-restored',
          participantId: result.participantId,
          pokemonInstanceId: result.targetPokemonInstanceId,
          previousHp: result.previousHp,
          currentHp: result.currentHp,
          appliedHealing: result.appliedHealing,
        };

        return {
          events: [itemUsedEvent, hpRestoredEvent],
          terminalOutcome: null,
          trainerStateUpdate: result.trainerState,
        };
      }

      case 'use-move':
        break;
    }

    const eligibility = evaluateBattleMoveExecutionEligibility(
      session.battle,
      entry,
    );

    if (!eligibility.canExecute) {
      return {
        events: [],
        terminalOutcome: null,
      };
    }

    const executionContext = createBattleMoveExecutionContext(
      session.battle,
      entry,
    );

    consumeBattleMovePp(executionContext);

    const moveUsedEvent: BattlePresentationEvent = {
      type: 'move-used',
      participantId: executionContext.actorParticipantId,
      pokemonInstanceId: executionContext.actorPokemon.pokemon.instanceId,
      moveId: executionContext.move.id,
    };

    const accuracyResult = resolveBattleMoveAccuracy(
      executionContext,
      this.random,
    );

    if (!accuracyResult.hit) {
      return {
        events: [
          moveUsedEvent,
          {
            type: 'move-missed',
            participantId: executionContext.actorParticipantId,
            pokemonInstanceId: executionContext.actorPokemon.pokemon.instanceId,
            moveId: executionContext.move.id,
          },
        ],

        terminalOutcome: null,
      };
    }

    const targetPreviousHp = executionContext.targetPokemon.currentHp;

    const damageResult = calculateBattleMoveDamage(executionContext);

    const damageApplication = applyBattleMoveDamage(
      executionContext,
      damageResult,
    );

    const events: BattlePresentationEvent[] = [moveUsedEvent];

    const resolvesDirectDamage =
      damageResult.damageClass !== 'status' && damageResult.power !== null;

    if (!resolvesDirectDamage) {
      return {
        events,
        terminalOutcome: null,
      };
    }

    const targetPokemonInstanceId =
      executionContext.targetPokemon.pokemon.instanceId;

    const targetParticipant = session.battle.participants.find((participant) =>
      participant.pokemon.some(
        (pokemonState) =>
          pokemonState.pokemon.instanceId === targetPokemonInstanceId,
      ),
    );

    if (!targetParticipant) {
      throw new Error(
        `Battle participant for target Pokémon "${targetPokemonInstanceId}" not found in battle "${session.battle.battleId}"`,
      );
    }

    events.push({
      type: 'damage-applied',
      participantId: targetParticipant.id,
      pokemonInstanceId: targetPokemonInstanceId,
      previousHp: targetPreviousHp,
      currentHp: damageApplication.currentHp,
      appliedDamage: damageApplication.appliedDamage,
      typeEffectiveness: damageResult.typeEffectiveness,
    });

    if (targetPreviousHp > 0 && damageApplication.currentHp === 0) {
      events.push({
        type: 'pokemon-fainted',
        participantId: targetParticipant.id,
        pokemonInstanceId: targetPokemonInstanceId,
      });
    }

    return {
      events,
      terminalOutcome: null,
    };
  }
}
