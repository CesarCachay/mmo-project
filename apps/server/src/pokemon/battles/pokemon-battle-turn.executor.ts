import {
  createBattleMoveExecutionContext,
  resolveBattleMoveAccuracy,
  consumeBattleMovePp,
  applyBattleMoveDamage,
  calculateBattleMoveDamage,
  evaluateBattleMoveExecutionEligibility,
  assertPokemonBattleCommandActionAllowed,
  applyPersistentBattlefieldMove,
  getBattleMoveMultiHitRule,
  resolveBattleMoveHitCount,
  applyBattleMoveStatusEffects,
  resolveBattleStatusAction,
} from '@cesar-mmo/shared';

import type {
  BattleMoveExecutionContext,
  BattlePresentationEvent,
  BattleStatusActionEffect,
  BattleTurnResolutionEntry,
  PokemonTrainerState,
} from '@cesar-mmo/shared';

import type { PokemonBattleSession } from './pokemon-battle-session';

import { applyPokemonTrainerBattleSwitch } from './pokemon-trainer-battle-switch.runtime';

import { resolvePokemonWildBattleRun } from './run/pokemon-wild-battle-run.runtime';

import { executePokemonWildBattleCapture } from './capture/pokemon-wild-battle-capture.runtime';

import { applyPokemonTrainerBattleMedicineItem } from '../items/pokemon-trainer-battle-medicine-item.runtime';
import type { PokemonOverworldItemRepository } from '../items/pokemon-overworld-item.repository';

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
  readonly medicineRepository?: PokemonOverworldItemRepository;
  readonly random?: () => number;
}

export class PokemonBattleTurnExecutor {
  private readonly trainerStateStore: PokemonTrainerStateStore;
  private readonly trainerService: PokemonTrainerService;
  private readonly captureService: PokemonCaptureService;
  private readonly medicineRepository?: PokemonOverworldItemRepository;
  private readonly random: () => number;

  constructor(options: PokemonBattleTurnExecutorOptions) {
    this.trainerStateStore = options.trainerStateStore;
    this.trainerService = options.trainerService;
    this.captureService = options.captureService;
    this.medicineRepository = options.medicineRepository;
    this.random = options.random ?? Math.random;
  }

  public async execute(
    session: PokemonBattleSession,
    entry: BattleTurnResolutionEntry,
    playerId: string,
  ): Promise<BattleTurnEntryExecutionResult> {
    /* Defense in depth: even a command inserted outside the normal network
     * path must still obey the battle-type rules at execution time. */
    assertPokemonBattleCommandActionAllowed(
      session.battle,
      entry.command.action,
    );

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

        const result = await applyPokemonTrainerBattleMedicineItem({
          session,
          entry,
          playerId,
          trainerStateStore: this.trainerStateStore,
          trainerService: this.trainerService,
          medicineRepository: this.medicineRepository,
        });

        const itemUsedEvent: BattlePresentationEvent = {
          type: 'item-used',
          participantId: result.participantId,
          itemId: result.itemId,
          targetPokemonInstanceId: result.targetPokemonInstanceId,
        };

        if (result.kind === 'hp') {
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

        const statusClearedEvents: BattlePresentationEvent[] = [];

        if (result.curedMajorStatus !== null) {
          statusClearedEvents.push({
            type: 'status-cleared',
            participantId: result.participantId,
            pokemonInstanceId: result.targetPokemonInstanceId,
            status: result.curedMajorStatus,
          });
        }

        if (result.curedConfusion) {
          statusClearedEvents.push({
            type: 'status-cleared',
            participantId: result.participantId,
            pokemonInstanceId: result.targetPokemonInstanceId,
            status: 'confusion',
          });
        }

        return {
          events: [itemUsedEvent, ...statusClearedEvents],
          terminalOutcome: null,
          trainerStateUpdate: result.trainerState,
        };
      }

      case 'use-move':
      case 'struggle':
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

    const statusAction = resolveBattleStatusAction(
      executionContext,
      this.random,
    );

    const statusActionEvents = this.createStatusActionEvents(
      executionContext,
      statusAction.effects,
    );

    if (!statusAction.canExecuteMove) {
      if (executionContext.actorPokemon.currentHp === 0) {
        statusActionEvents.push({
          type: 'pokemon-fainted',
          participantId: executionContext.actorParticipantId,
          pokemonInstanceId: executionContext.actorPokemon.pokemon.instanceId,
        });
      }

      return {
        events: statusActionEvents,
        terminalOutcome: null,
      };
    }

    if (entry.command.action.type === 'use-move') {
      consumeBattleMovePp(executionContext);
    }

    const baseMoveUsedEvent = {
      type: 'move-used' as const,
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
          ...statusActionEvents,
          baseMoveUsedEvent,
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

    applyPersistentBattlefieldMove(
      session.battle,
      executionContext.actorParticipantId,
      executionContext.move.id,
    );

    const targetPreviousHp = executionContext.targetPokemon.currentHp;
    const multiHitRule = getBattleMoveMultiHitRule(executionContext.move.id);
    const plannedHitCount = resolveBattleMoveHitCount(
      executionContext.move.id,
      this.random,
    );

    const resolvesDirectDamage =
      executionContext.move.damageClass !== 'status' &&
      executionContext.move.power !== null;

    if (!resolvesDirectDamage) {
      return {
        events: [
          ...statusActionEvents,
          baseMoveUsedEvent,
          ...this.createStatusInflictedEvents(executionContext, 1),
        ],
        terminalOutcome: null,
      };
    }

    let totalAppliedDamage = 0;
    let currentHp = targetPreviousHp;
    let typeEffectiveness = 1;
    let actualHitCount = 0;

    for (let hitIndex = 0; hitIndex < plannedHitCount; hitIndex += 1) {
      if (currentHp <= 0) {
        break;
      }

      const damageResult = calculateBattleMoveDamage(
        executionContext,
        this.random,
      );

      if (hitIndex === 0) {
        typeEffectiveness = damageResult.typeEffectiveness;
      }

      const damageApplication = applyBattleMoveDamage(
        executionContext,
        damageResult,
      );

      totalAppliedDamage += damageApplication.appliedDamage;
      currentHp = damageApplication.currentHp;
      actualHitCount += 1;
    }

    const moveUsedEvent: BattlePresentationEvent = multiHitRule
      ? { ...baseMoveUsedEvent, hitCount: actualHitCount }
      : baseMoveUsedEvent;

    const events: BattlePresentationEvent[] = [
      ...statusActionEvents,
      moveUsedEvent,
    ];
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
      currentHp,
      appliedDamage: totalAppliedDamage,
      typeEffectiveness,
    });

    events.push(
      ...this.createStatusInflictedEvents(executionContext, actualHitCount),
    );

    if (targetPreviousHp > 0 && currentHp === 0) {
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

  private createStatusActionEvents(
    context: BattleMoveExecutionContext,
    effects: readonly BattleStatusActionEffect[],
  ): BattlePresentationEvent[] {
    const participantId = context.actorParticipantId;
    const pokemonInstanceId = context.actorPokemon.pokemon.instanceId;

    return effects.map((effect): BattlePresentationEvent => {
      switch (effect.type) {
        case 'status-cleared':
          return {
            type: 'status-cleared',
            participantId,
            pokemonInstanceId,
            status: effect.status,
          };

        case 'action-prevented':
          return {
            type: 'status-action-prevented',
            participantId,
            pokemonInstanceId,
            status: effect.status,
          };

        case 'confusion-self-damage':
          return {
            type: 'confusion-self-damage',
            participantId,
            pokemonInstanceId,
            previousHp: effect.previousHp,
            currentHp: effect.currentHp,
            appliedDamage: effect.appliedDamage,
          };
      }
    });
  }

  private createStatusInflictedEvents(
    context: BattleMoveExecutionContext,
    successfulHitCount: number,
  ): BattlePresentationEvent[] {
    return applyBattleMoveStatusEffects({
      context,
      successfulHitCount,
      random: this.random,
    })
      .filter((result) => result.type === 'applied')
      .map((result) => ({
        type: 'status-inflicted' as const,
        participantId: result.targetParticipantId,
        pokemonInstanceId: result.targetPokemonInstanceId,
        status: result.status,
        sourceParticipantId: context.actorParticipantId,
        sourcePokemonInstanceId: context.actorPokemon.pokemon.instanceId,
        moveId: context.move.id,
      }));
  }
}
