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

export interface PokemonBattleNetworkControllerOptions {
  readonly trainerStateStore: PokemonTrainerStateStore;
  readonly trainerService: PokemonTrainerService;
  readonly battleSessionStore: PokemonBattleSessionStore;
  readonly battleTurnStore: PokemonBattleTurnStore;
  readonly turnExecutor: PokemonBattleTurnExecutor;
  readonly trainerStatePresenter: PokemonTrainerStateNetworkPresenter;
}

export class PokemonBattleNetworkController {
  private readonly trainerStateStore: PokemonTrainerStateStore;
  private readonly trainerService: PokemonTrainerService;
  private readonly battleSessionStore: PokemonBattleSessionStore;
  private readonly battleTurnStore: PokemonBattleTurnStore;
  private readonly turnExecutor: PokemonBattleTurnExecutor;
  private readonly trainerStatePresenter: PokemonTrainerStateNetworkPresenter;

  constructor(options: PokemonBattleNetworkControllerOptions) {
    this.trainerStateStore = options.trainerStateStore;
    this.trainerService = options.trainerService;
    this.battleSessionStore = options.battleSessionStore;
    this.battleTurnStore = options.battleTurnStore;
    this.turnExecutor = options.turnExecutor;
    this.trainerStatePresenter = options.trainerStatePresenter;
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

      client.emit(POKEMON_EVENTS.BATTLE_TURN_RESOLVED, {
        battleId: session.battle.battleId,
        turnNumber: turn.number,
        events: presentationEvents,
      } satisfies PokemonBattleTurnResolvedPayload);

      if (terminalOutcome === 'trainer-escaped') {
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

      const battleIsTerminal =
        continuationOutcome.type === 'trainer-defeated' ||
        continuationOutcome.type === 'wild-defeated';

      const updatedTrainerState = battleIsTerminal
        ? await this.syncBattleResultToTrainer(
            session,
            trainerBinding.trainerId,
            trainerBinding.participantId,
          )
        : null;

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

      this.trainerStatePresenter.emitTrainerState(client, updatedTrainerState);

      client.emit(POKEMON_EVENTS.BATTLE_COMPLETED, {
        battleId: session.battle.battleId,
        outcome: outcomeRuntime.type,
      });
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
