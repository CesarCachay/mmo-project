import type { Socket } from 'socket.io';

import {
  POKEMON_EVENTS,
  createBattleCommand,
  isPokemonBattleCommandInput,
  isBattleTurnReady,
  createBattleTurnResolutionOrder,
  resolveTrainerBattleContinuationOutcome,
  resolveWildBattleContinuationOutcome,
  isPokemonBattleReplacementInput,
  planBattleTrainerMedicineItemUse,
  assertPokemonBattleCommandActionAllowed,
  applyBattleEndTurnStatusEffects,
} from '@cesar-mmo/shared';

import type {
  BattlePresentationEvent,
  PokemonBattleStateUpdatedPayload,
  PokemonBattleTurnResolvedPayload,
  PokemonBattleCompletedPayload,
  PokemonTrainerState,
  PokemonBattleCommandInput,
  PokemonTrainerBattleId,
  PokemonTrainerBattleCompletionRewards,
} from '@cesar-mmo/shared';

import type { PokemonTrainerId } from '../pokemon-trainer-identity';

import type {
  PokemonBattleSession,
  PokemonBattleTrainerBinding,
} from './pokemon-battle-session';

import { PokemonTrainerStateStore } from '../pokemon-trainer-state.store';

import { PokemonTrainerService } from '../pokemon-trainer.service';

import { PokemonWildBattleProgressionService } from './pokemon-wild-battle-progression.service';

import { PokemonBattleSessionStore } from './pokemon-battle-session.store';

import { PokemonBattleTurnStore } from './pokemon-battle-turn.store';

import { createWildBattleCommand } from './pokemon-wild-battle-command.factory';
import { createTrainerBattleAiCommand } from './pokemon-trainer-battle-ai.factory';

import { assertPokemonTrainerBattleSwitchAllowed } from './pokemon-trainer-battle-switch.validator';

import { planPokemonWildBattleCapture } from './capture/pokemon-wild-battle-capture.runtime';

import {
  applyPokemonWildBattleOutcome,
  applyPokemonWildBattleEscapeOutcome,
  applyPokemonWildBattleCaptureOutcome,
} from './pokemon-wild-battle-outcome.runtime';

import { applyPokemonTrainerBattleReplacement } from './pokemon-trainer-battle-replacement.runtime';
import { applyPokemonTrainerBattleOpponentReplacement } from './pokemon-trainer-battle-opponent-replacement.runtime';
import { applyPokemonTrainerBattleOutcome } from './pokemon-trainer-battle-outcome.runtime';

import { PokemonTrainerStateNetworkPresenter } from '../network/PokemonTrainerStateNetworkPresenter';

import { PokemonBattleTurnExecutor } from './pokemon-battle-turn.executor';

import { createPokemonWildBattleProgressionPresentationEvents } from './pokemon-wild-battle-progression.presentation';
import type { PokemonTrainerBattleVictoryResult } from './pokemon-trainer-battle-victory.service';

export interface PokemonBattleNetworkControllerOptions {
  readonly trainerStateStore: PokemonTrainerStateStore;
  readonly trainerService: PokemonTrainerService;
  readonly battleSessionStore: PokemonBattleSessionStore;
  readonly battleTurnStore: PokemonBattleTurnStore;
  readonly turnExecutor: PokemonBattleTurnExecutor;
  readonly wildBattleProgressionService: PokemonWildBattleProgressionService;
  readonly trainerStatePresenter: PokemonTrainerStateNetworkPresenter;
  readonly onTrainerDefeated: (
    playerId: string,
    trainerId: PokemonTrainerId,
  ) => Promise<void>;
  readonly onTrainerBattleVictory: (
    trainerId: PokemonTrainerId,
    trainerBattleId: PokemonTrainerBattleId,
  ) => Promise<PokemonTrainerBattleVictoryResult>;
}

export class PokemonBattleNetworkController {
  private readonly trainerStateStore: PokemonTrainerStateStore;
  private readonly trainerService: PokemonTrainerService;
  private readonly battleSessionStore: PokemonBattleSessionStore;
  private readonly battleTurnStore: PokemonBattleTurnStore;
  private readonly turnExecutor: PokemonBattleTurnExecutor;
  private readonly wildBattleProgressionService: PokemonWildBattleProgressionService;
  private readonly trainerStatePresenter: PokemonTrainerStateNetworkPresenter;
  private readonly onTrainerDefeated: PokemonBattleNetworkControllerOptions['onTrainerDefeated'];
  private readonly onTrainerBattleVictory: PokemonBattleNetworkControllerOptions['onTrainerBattleVictory'];

  constructor(options: PokemonBattleNetworkControllerOptions) {
    this.trainerStateStore = options.trainerStateStore;
    this.trainerService = options.trainerService;
    this.battleSessionStore = options.battleSessionStore;
    this.battleTurnStore = options.battleTurnStore;
    this.turnExecutor = options.turnExecutor;
    this.wildBattleProgressionService = options.wildBattleProgressionService;
    this.trainerStatePresenter = options.trainerStatePresenter;
    this.onTrainerDefeated = options.onTrainerDefeated;
    this.onTrainerBattleVictory = options.onTrainerBattleVictory;
  }

  public async handleCommand(client: Socket, payload: unknown): Promise<void> {
    if (!isPokemonBattleCommandInput(payload)) {
      return;
    }

    const session = this.battleSessionStore.getByPlayerId(client.id);

    if (!session) {
      return;
    }

    if (session.battle.battleId !== payload.battleId) {
      return;
    }

    const trainerBinding = session.trainerBindings.find(
      (binding) => binding.playerId === client.id,
    );

    if (!trainerBinding) {
      return;
    }

    if (session.battle.type === 'trainer') {
      await this.handleTrainerBattleCommand(
        client,
        session,
        trainerBinding,
        payload,
      );
      return;
    }

    /* A normal Battle command must never bypass a server-authoritative forced replacement */
    const preCommandOutcome = resolveWildBattleContinuationOutcome(
      session.battle,
    );

    if (
      preCommandOutcome.type === 'trainer-replacement-required' ||
      preCommandOutcome.type === 'trainer-defeated' ||
      preCommandOutcome.type === 'wild-defeated'
    ) {
      return;
    }

    try {
      if (payload.action.type === 'use-item') {
        if (payload.action.target.type === 'wild-active') {
          planPokemonWildBattleCapture({
            session,
            playerId: client.id,
            action: payload.action,
            trainerStateStore: this.trainerStateStore,
          });
        } else {
          const trainerState = this.trainerStateStore.get(
            trainerBinding.trainerId,
          );

          if (!trainerState) {
            throw new Error(
              `Pokémon Trainer state not found for trainer "${trainerBinding.trainerId}"`,
            );
          }

          planBattleTrainerMedicineItemUse(
            session.battle,
            trainerBinding.participantId,
            payload.action,
            trainerState.inventory,
          );
        }
      }

      if (payload.action.type === 'switch-pokemon') {
        assertPokemonTrainerBattleSwitchAllowed({
          session,
          playerId: client.id,
          pokemonIndex: payload.action.pokemonIndex,
        });
      }

      const trainerCommand = createBattleCommand(session.battle, {
        participantId: trainerBinding.participantId,

        action: payload.action,
      });

      let turn = this.battleTurnStore.submitCommand(
        session.battle,
        trainerCommand,
      );

      const wildCommand = createWildBattleCommand(session.battle);

      turn = this.battleTurnStore.submitCommand(session.battle, wildCommand);

      if (!isBattleTurnReady(session.battle, turn)) {
        throw new Error(
          `Battle turn ${turn.number} for battle "${session.battle.battleId}" should be ready after Wild command submission`,
        );
      }

      const resolutionOrder = createBattleTurnResolutionOrder(
        session.battle,
        turn,
        Math.random,
      );

      const presentationEvents: BattlePresentationEvent[] = [];

      let terminalOutcome: 'trainer-escaped' | 'wild-captured' | null = null;

      let trainerStateUpdate: PokemonTrainerState | null = null;

      for (const entry of resolutionOrder.entries) {
        const executionResult = await this.turnExecutor.execute(
          session,
          entry,
          client.id,
        );

        presentationEvents.push(...executionResult.events);

        if (executionResult.trainerStateUpdate) {
          trainerStateUpdate = executionResult.trainerStateUpdate;
        }

        if (executionResult.terminalOutcome) {
          terminalOutcome = executionResult.terminalOutcome;
          break;
        }
      }

      if (!terminalOutcome) {
        presentationEvents.push(...this.applyEndTurnStatusEffects(session));
      }

      const emitTurnResolved = (): void => {
        client.emit(POKEMON_EVENTS.BATTLE_TURN_RESOLVED, {
          battleId: session.battle.battleId,
          turnNumber: turn.number,
          events: [...presentationEvents],
        } satisfies PokemonBattleTurnResolvedPayload);
      };

      if (terminalOutcome === 'trainer-escaped') {
        emitTurnResolved();
        const updatedTrainerState = await this.syncBattleResultToTrainer(
          session,
          trainerBinding.trainerId,
          trainerBinding.participantId,
        );

        const escapeOutcome = applyPokemonWildBattleEscapeOutcome({
          battleId: session.battle.battleId,
          battleSessionStore: this.battleSessionStore,
          battleTurnStore: this.battleTurnStore,
        });

        this.trainerStatePresenter.emitTrainerState(
          client,
          updatedTrainerState,
        );

        client.emit(POKEMON_EVENTS.BATTLE_COMPLETED, {
          battleId: session.battle.battleId,
          outcome: escapeOutcome.type,
        } satisfies PokemonBattleCompletedPayload);

        return;
      }

      if (terminalOutcome === 'wild-captured') {
        emitTurnResolved();
        if (!trainerStateUpdate) {
          throw new Error(
            `Trainer state missing after successful capture in battle "${session.battle.battleId}"`,
          );
        }

        const captureOutcome = applyPokemonWildBattleCaptureOutcome({
          battleId: session.battle.battleId,
          battleSessionStore: this.battleSessionStore,
          battleTurnStore: this.battleTurnStore,
        });

        this.trainerStatePresenter.emitTrainerState(client, trainerStateUpdate);

        client.emit(POKEMON_EVENTS.BATTLE_COMPLETED, {
          battleId: session.battle.battleId,
          outcome: captureOutcome.type,
        } satisfies PokemonBattleCompletedPayload);

        return;
      }

      const continuationOutcome = resolveWildBattleContinuationOutcome(
        session.battle,
      );

      if (
        trainerStateUpdate &&
        (continuationOutcome.type === 'continue' ||
          continuationOutcome.type === 'trainer-replacement-required')
      ) {
        this.trainerStatePresenter.emitTrainerState(client, trainerStateUpdate);
      }

      let updatedTrainerState: PokemonTrainerState | null = null;

      /*
       * ==========================================================
       * TRAINER DEFEATED
       * ==========================================================
       */
      if (continuationOutcome.type === 'trainer-defeated') {
        updatedTrainerState = await this.syncBattleResultToTrainer(
          session,
          trainerBinding.trainerId,
          trainerBinding.participantId,
        );
      }

      /*
       * ==========================================================
       * WILD DEFEATED
       * ==========================================================
       */
      if (continuationOutcome.type === 'wild-defeated') {
        /* 1. Persist authoritative Battle consequences first */
        await this.syncBattleResultToTrainer(
          session,
          trainerBinding.trainerId,
          trainerBinding.participantId,
        );

        /* 2. Apply EXP to the Party atomically */
        const progressionResult =
          await this.wildBattleProgressionService.applyVictoryExperience(
            session,
          );

        updatedTrainerState = progressionResult.trainerState;

        presentationEvents.push(
          ...createPokemonWildBattleProgressionPresentationEvents({
            participantId: trainerBinding.participantId,
            result: progressionResult,
          }),
        );
      }

      /*
       * Battle lifecycle is applied only AFTER all
       * persistence/progression has completed successfully.
       */
      emitTurnResolved();

      const outcomeRuntime = applyPokemonWildBattleOutcome({
        battleId: session.battle.battleId,
        outcome: continuationOutcome,
        battleSessionStore: this.battleSessionStore,
        battleTurnStore: this.battleTurnStore,
      });

      if (outcomeRuntime.type === 'continue') {
        const nextTurn = this.battleTurnStore.advance(session.battle);

        client.emit(POKEMON_EVENTS.BATTLE_STATE_UPDATED, {
          battle: session.battle,
          resolvedTurnNumber: turn.number,
          interactionState: 'selecting-action',
          nextTurnNumber: nextTurn.number,
          replacementPokemonIndexes: [],
        } satisfies PokemonBattleStateUpdatedPayload);

        return;
      }

      if (outcomeRuntime.type === 'trainer-replacement-required') {
        client.emit(POKEMON_EVENTS.BATTLE_STATE_UPDATED, {
          battle: session.battle,
          resolvedTurnNumber: turn.number,
          interactionState: 'replacement-required',
          nextTurnNumber: null,
          replacementPokemonIndexes: outcomeRuntime.replacementPokemonIndexes,
        } satisfies PokemonBattleStateUpdatedPayload);

        return;
      }

      if (!updatedTrainerState) {
        throw new Error(
          `Trainer state was not synchronized before completing battle "${session.battle.battleId}"`,
        );
      }

      /* 1. Publish the final Battle Party state */

      this.trainerStatePresenter.emitTrainerState(client, updatedTrainerState);

      /* 2. Complete Battle presentation FIRST */

      client.emit(POKEMON_EVENTS.BATTLE_COMPLETED, {
        battleId: session.battle.battleId,
        outcome: outcomeRuntime.type,
      } satisfies PokemonBattleCompletedPayload);

      /* 3. Trainer defeat → Blackout recovery */

      if (outcomeRuntime.type === 'trainer-defeated') {
        await this.onTrainerDefeated(client.id, trainerBinding.trainerId);
      }
    } catch (error: unknown) {
      console.warn(`[BattleCommand] rejected for player ${client.id}`, error);
    }
  }

  private applyEndTurnStatusEffects(
    session: PokemonBattleSession,
  ): BattlePresentationEvent[] {
    const events: BattlePresentationEvent[] = [];

    for (const effect of applyBattleEndTurnStatusEffects(session.battle)) {
      events.push({ ...effect });

      if (effect.currentHp === 0) {
        events.push({
          type: 'pokemon-fainted',
          participantId: effect.participantId,
          pokemonInstanceId: effect.pokemonInstanceId,
        });
      }
    }

    return events;
  }

  private async handleTrainerBattleCommand(
    client: Socket,
    session: PokemonBattleSession,
    trainerBinding: PokemonBattleTrainerBinding,
    payload: PokemonBattleCommandInput,
  ): Promise<void> {
    const continuationBefore = resolveTrainerBattleContinuationOutcome(
      session.battle,
      trainerBinding.participantId,
    );

    if (continuationBefore.type !== 'continue') {
      return;
    }

    try {
      /*
       * Enforce Wild-vs-Trainer semantics before any inventory planning or
       * turn-store mutation. This is intentionally shared-domain logic so a
       * modified client cannot bypass Trainer Battle restrictions.
       */
      assertPokemonBattleCommandActionAllowed(session.battle, payload.action);

      if (payload.action.type === 'use-item') {
        const trainerState = this.trainerStateStore.get(
          trainerBinding.trainerId,
        );

        if (!trainerState) {
          throw new Error(
            `Pokémon Trainer state not found for trainer "${trainerBinding.trainerId}"`,
          );
        }

        planBattleTrainerMedicineItemUse(
          session.battle,
          trainerBinding.participantId,
          payload.action,
          trainerState.inventory,
        );
      }

      if (payload.action.type === 'switch-pokemon') {
        assertPokemonTrainerBattleSwitchAllowed({
          session,
          playerId: client.id,
          pokemonIndex: payload.action.pokemonIndex,
        });
      }

      const playerCommand = createBattleCommand(session.battle, {
        participantId: trainerBinding.participantId,
        action: payload.action,
      });

      /*
       * Build both commands before mutating the turn store.
       *
       * If AI command construction fails, the player's command must not be
       * left partially submitted; otherwise the next client retry would be
       * rejected as a duplicate command for the same turn.
       */
      const aiCommand = createTrainerBattleAiCommand(session);

      let turn = this.battleTurnStore.submitCommand(
        session.battle,
        playerCommand,
      );

      turn = this.battleTurnStore.submitCommand(session.battle, aiCommand);

      if (!isBattleTurnReady(session.battle, turn)) {
        throw new Error(
          `Trainer Battle turn ${turn.number} for battle "${session.battle.battleId}" should be ready after AI command submission`,
        );
      }

      const resolutionOrder = createBattleTurnResolutionOrder(
        session.battle,
        turn,
        Math.random,
      );

      const presentationEvents: BattlePresentationEvent[] = [];
      let trainerStateUpdate: PokemonTrainerState | null = null;

      for (const entry of resolutionOrder.entries) {
        const executionResult = await this.turnExecutor.execute(
          session,
          entry,
          client.id,
        );

        presentationEvents.push(...executionResult.events);

        if (executionResult.trainerStateUpdate) {
          trainerStateUpdate = executionResult.trainerStateUpdate;
        }

        if (executionResult.terminalOutcome) {
          throw new Error(
            `Unexpected Wild terminal outcome "${executionResult.terminalOutcome}" in Trainer Battle "${session.battle.battleId}"`,
          );
        }
      }

      presentationEvents.push(...this.applyEndTurnStatusEffects(session));

      const continuationAfter = resolveTrainerBattleContinuationOutcome(
        session.battle,
        trainerBinding.participantId,
      );

      let nextTurnNumber: number | null = null;
      let interactionState:
        PokemonBattleStateUpdatedPayload['interactionState'] | null = null;
      let replacementPokemonIndexes: readonly number[] = [];

      if (continuationAfter.type === 'continue') {
        const nextTurn = this.battleTurnStore.advance(session.battle);
        nextTurnNumber = nextTurn.number;
        interactionState = 'selecting-action';
      } else if (continuationAfter.type === 'player-replacement-required') {
        interactionState = 'replacement-required';
        replacementPokemonIndexes = continuationAfter.replacementPokemonIndexes;
      } else if (continuationAfter.type === 'opponent-replacement-required') {
        /*
         * NPC forced replacement is server-authoritative and automatic.
         * Apply it before publishing the resolved turn so the switch event is
         * serialized immediately after the faint presentation for that turn.
         */
        const replacementResult = applyPokemonTrainerBattleOpponentReplacement({
          session,
          localParticipantId: trainerBinding.participantId,
          battleTurnStore: this.battleTurnStore,
        });

        presentationEvents.push(replacementResult.presentationEvent);
        nextTurnNumber = replacementResult.nextTurnNumber;
        interactionState = 'selecting-action';
      }

      client.emit(POKEMON_EVENTS.BATTLE_TURN_RESOLVED, {
        battleId: session.battle.battleId,
        turnNumber: turn.number,
        events: [...presentationEvents],
      } satisfies PokemonBattleTurnResolvedPayload);

      if (trainerStateUpdate) {
        this.trainerStatePresenter.emitTrainerState(client, trainerStateUpdate);
      }

      if (interactionState) {
        client.emit(POKEMON_EVENTS.BATTLE_STATE_UPDATED, {
          battle: session.battle,
          resolvedTurnNumber: turn.number,
          interactionState,
          nextTurnNumber,
          replacementPokemonIndexes,
        } satisfies PokemonBattleStateUpdatedPayload);
        return;
      }

      if (
        continuationAfter.type !== 'player-defeated' &&
        continuationAfter.type !== 'opponent-defeated'
      ) {
        throw new Error(
          `Unsupported Trainer Battle continuation "${continuationAfter.type}" after turn ${turn.number}`,
        );
      }

      /*
       * Persist the player's authoritative Party state BEFORE releasing the
       * Battle session. This guarantees the final HP/PP snapshot survives
       * both victory and defeat, and gives Step 10B a durable source for
       * rewards / blackout healing.
       */
      const updatedTrainerState = await this.syncBattleResultToTrainer(
        session,
        trainerBinding.trainerId,
        trainerBinding.participantId,
      );

      let completionTrainerState = updatedTrainerState;
      let trainerBattleRewards: PokemonTrainerBattleCompletionRewards | undefined;

      if (continuationAfter.type === 'opponent-defeated') {
        const trainerBattleContext = session.trainerBattle;

        if (!trainerBattleContext) {
          throw new Error(
            `Trainer Battle "${session.battle.battleId}" is missing Trainer Battle context`,
          );
        }

        try {
          const victoryResult = await this.onTrainerBattleVictory(
            trainerBinding.trainerId,
            trainerBattleContext.trainerBattleId,
          );

          completionTrainerState = victoryResult.trainerState;

          if (victoryResult.firstVictory) {
            trainerBattleRewards = {
              money: victoryResult.rewardMoney,
              items: victoryResult.rewardItems,
              ...(victoryResult.gymBadgeAward
                ? { gymBadge: victoryResult.gymBadgeAward }
                : {}),
            };
          }
        } catch (error: unknown) {
          /*
           * A persistence outage must not strand an already-resolved Battle.
           * The durable Party result is already saved; log the reward/progress
           * failure and still complete the Battle. Because victory recording is
           * idempotent, the player can earn it on a later successful rematch.
           */
          console.error(
            `[TrainerBattleVictory] failed for Trainer Battle "${trainerBattleContext.trainerBattleId}"`,
            error,
          );
        }
      }

      const outcomeRuntime = applyPokemonTrainerBattleOutcome({
        battleId: session.battle.battleId,
        outcome: continuationAfter,
        battleSessionStore: this.battleSessionStore,
        battleTurnStore: this.battleTurnStore,
      });

      this.trainerStatePresenter.emitTrainerState(
        client,
        completionTrainerState,
      );

      client.emit(POKEMON_EVENTS.BATTLE_COMPLETED, {
        battleId: session.battle.battleId,
        outcome: outcomeRuntime.type,
        ...(trainerBattleRewards ? { trainerBattleRewards } : {}),
      } satisfies PokemonBattleCompletedPayload);

      /*
       * Step 10B intentionally owns: victory rewards, defeated-Trainer
       * persistence, completion acknowledgement, blackout healing and world
       * recovery. Do not relocate the player from this core outcome step.
       */
    } catch (error: unknown) {
      console.warn(
        `[TrainerBattleCommand] rejected for player ${client.id}`,
        error,
      );
    }
  }

  public async handlePlayerDisconnected(playerId: string): Promise<void> {
    const session = this.battleSessionStore.getByPlayerId(playerId);

    if (!session) {
      return;
    }

    const battleId = session.battle.battleId;
    const trainerBinding = session.trainerBindings.find(
      (binding) => binding.playerId === playerId,
    );

    try {
      /*
       * Persist the latest authoritative HP / PP snapshot when possible.
       * A transient network loss must not leave the Trainer permanently
       * bound to an orphaned Battle session after reconnect.
       */
      if (trainerBinding) {
        await this.syncBattleResultToTrainer(
          session,
          trainerBinding.trainerId,
          trainerBinding.participantId,
        );
      }
    } catch (error: unknown) {
      console.error(
        `[BattleDisconnect] failed to persist battle "${battleId}" for player ${playerId}`,
        error,
      );
    } finally {
      this.battleTurnStore.remove(battleId);
      this.battleSessionStore.remove(battleId);
    }
  }

  public handleReplacement(client: Socket, payload: unknown): void {
    if (!isPokemonBattleReplacementInput(payload)) {
      return;
    }

    const session = this.battleSessionStore.getByPlayerId(client.id);

    if (!session) {
      return;
    }

    if (session.battle.battleId !== payload.battleId) {
      console.warn('[BattleReplacement] rejected battle mismatch', {
        playerId: client.id,
        requestedBattleId: payload.battleId,
        activeBattleId: session.battle.battleId,
      });

      return;
    }

    try {
      const result = applyPokemonTrainerBattleReplacement({
        session,
        playerId: client.id,
        replacementPokemonIndex: payload.replacementPokemonIndex,
        battleTurnStore: this.battleTurnStore,
      });

      client.emit(POKEMON_EVENTS.BATTLE_REPLACEMENT_RESOLVED, {
        battle: session.battle,
        nextTurnNumber: result.nextTurnNumber,
      });
    } catch (error: unknown) {
      console.warn(
        `[BattleReplacement] rejected for player ${client.id}`,
        error,
      );
    }
  }

  private async syncBattleResultToTrainer(
    session: PokemonBattleSession,
    trainerId: PokemonTrainerId,
    trainerParticipantId: string,
  ): Promise<PokemonTrainerState> {
    const trainerParticipant = session.battle.participants.find(
      (participant) => participant.id === trainerParticipantId,
    );

    if (!trainerParticipant) {
      throw new Error(
        `Trainer participant "${trainerParticipantId}" not found while finalizing battle "${session.battle.battleId}"`,
      );
    }

    if (trainerParticipant.type !== 'trainer') {
      throw new Error(
        `Battle participant "${trainerParticipant.id}" is not a Trainer`,
      );
    }

    return this.trainerService.syncBattleParticipantResult(
      trainerId,
      trainerParticipant,
    );
  }
}
