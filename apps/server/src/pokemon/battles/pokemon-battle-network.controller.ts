import type { Socket } from 'socket.io';

import {
  POKEMON_EVENTS,
  createBattleCommand,
  isPokemonBattleCommandInput,
  isBattleTurnReady,
  createBattleTurnResolutionOrder,
  resolveWildBattleContinuationOutcome,
  isPokemonBattleReplacementInput,
  planBattleHealingItemUse,
} from '@cesar-mmo/shared';

import type {
  BattlePresentationEvent,
  PokemonBattleStateUpdatedPayload,
  PokemonBattleTurnResolvedPayload,
  PokemonBattleCompletedPayload,
  PokemonTrainerState,
} from '@cesar-mmo/shared';

import type { PokemonTrainerId } from '../pokemon-trainer-identity';

import type { PokemonBattleSession } from './pokemon-battle-session';

import { PokemonTrainerStateStore } from '../pokemon-trainer-state.store';

import { PokemonTrainerService } from '../pokemon-trainer.service';

import { PokemonWildBattleProgressionService } from './pokemon-wild-battle-progression.service';

import { PokemonBattleSessionStore } from './pokemon-battle-session.store';

import { PokemonBattleTurnStore } from './pokemon-battle-turn.store';

import { createWildBattleCommand } from './pokemon-wild-battle-command.factory';

import { assertPokemonTrainerBattleSwitchAllowed } from './pokemon-trainer-battle-switch.validator';

import { planPokemonWildBattleCapture } from './capture/pokemon-wild-battle-capture.runtime';

import {
  applyPokemonWildBattleOutcome,
  applyPokemonWildBattleEscapeOutcome,
  applyPokemonWildBattleCaptureOutcome,
} from './pokemon-wild-battle-outcome.runtime';

import { applyPokemonTrainerBattleReplacement } from './pokemon-trainer-battle-replacement.runtime';

import { PokemonTrainerStateNetworkPresenter } from '../network/PokemonTrainerStateNetworkPresenter';

import { PokemonBattleTurnExecutor } from './pokemon-battle-turn.executor';

import { createPokemonWildBattleProgressionPresentationEvents } from './pokemon-wild-battle-progression.presentation';

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

  constructor(options: PokemonBattleNetworkControllerOptions) {
    this.trainerStateStore = options.trainerStateStore;
    this.trainerService = options.trainerService;
    this.battleSessionStore = options.battleSessionStore;
    this.battleTurnStore = options.battleTurnStore;
    this.turnExecutor = options.turnExecutor;
    this.wildBattleProgressionService = options.wildBattleProgressionService;
    this.trainerStatePresenter = options.trainerStatePresenter;
    this.onTrainerDefeated = options.onTrainerDefeated;
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

          planBattleHealingItemUse(
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
