import Phaser from "phaser";

import type {
  BattleInstance,
  PokemonBattleStartedPayload,
  PokemonBattleReplacementResolvedPayload,
  PokemonBattleCompletedPayload,
  PokemonBattleStateUpdatedPayload,
  PokemonBattleCommandInput,
  PokemonBattleReplacementInput,
  BattlePresentationEvent,
  PokemonBattleTurnResolvedPayload,
  PokemonTrainerState,
  PokemonItemId,
  PokemonMoveLearningDecisionInput,
  PokemonMoveLearningResolvedPayload,
  PokemonMoveLearningErrorPayload,
  BattleMoveLearningRequiredEvent,
  PokemonEvolutionDecisionInput,
  PokemonEvolutionRequiredPayload,
  PokemonEvolutionResolvedPayload,
  PokemonEvolutionErrorPayload,
} from "@cesar-mmo/shared";

import {
  calculatePokemonMaxHp,
  evaluatePokemonBattleItemRule,
  evaluatePokemonBattleRunRule,
  getPokemonInventoryItemQuantity,
  getPokemonItem,
  type PokemonBattleRuleRejectionReason,
} from "@cesar-mmo/shared";

import { WildBattleAudioController } from "./audio/WildBattleAudioController";

import { PokemonSpriteLoader } from "../pokemon/PokemonSpriteLoader";
import { BattleOverlay } from "./ui/BattleOverlay";
import type { BattleClientInteractionState } from "./battle-client.types";
import { formatPokemonBattleRuleRejectionMessage } from "./rules/battle-rules-ui";

import {
  BattlePresentationQueue,
  type BattlePresentationEventContext,
  type BattlePresentationEventBatchContext,
} from "./presentation/BattlePresentationQueue";

import { formatBattlePresentationMessage } from "./presentation/battle-presentation-message";
import {
  BATTLE_PRESENTATION_TIMING,
  getBattlePresentationMessageDuration,
} from "./presentation/battle-presentation-timing";
import { getPokemonDisplayName } from "../pokemon/pokemon-presentation.utils";
import { PokemonEvolutionPresentationController } from "./evolution/PokemonEvolutionPresentationController";
import { PokemonEvolutionRecoveryPresentationQueue } from "./evolution/PokemonEvolutionRecoveryPresentationQueue";
import { PokemonBattleProgressionPresentationCoordinator } from "./progression/PokemonBattleProgressionPresentationCoordinator";
import { PokemonBattleEvolutionHudSyncCoordinator } from "./evolution/PokemonBattleEvolutionHudSyncCoordinator";
import { syncAuthoritativeTrainerPokemonIntoBattleSnapshot } from "./evolution/syncAuthoritativeTrainerPokemonIntoBattleSnapshot";

type BattleExperienceGainedPresentationEvent = Extract<
  BattlePresentationEvent,
  { readonly type: "experience-gained" }
>;

export class BattleController {
  private activeBattlePayload?: PokemonBattleStartedPayload;
  private readonly overlay: BattleOverlay;
  private readonly pokemonSpriteLoader: PokemonSpriteLoader;

  private readonly presentationQueue: BattlePresentationQueue;

  private readonly pendingStateUpdates = new Map<
    number,
    PokemonBattleStateUpdatedPayload
  >();
  private pendingCompletion?: PokemonBattleCompletedPayload;
  private committedCompletion?: PokemonBattleCompletedPayload;

  private interactionState: BattleClientInteractionState = "completed";
  private readonly sendBattleCommand: (input: PokemonBattleCommandInput) => void;
  private readonly sendBattleReplacement: (input: PokemonBattleReplacementInput) => void;
  private replacementPokemonIndexes: readonly number[] = [];

  private trainerState?: PokemonTrainerState;

  private selectedItemId?: PokemonItemId;

  private readonly audio: WildBattleAudioController;
  private readonly onCompletionAcknowledged: (
    payload: PokemonBattleCompletedPayload
  ) => void;

  private readonly sendMoveLearningDecision: (
    input: PokemonMoveLearningDecisionInput
  ) => void;

  private readonly evolutionPresentationController: PokemonEvolutionPresentationController;
  private readonly progressionPresentationCoordinator: PokemonBattleProgressionPresentationCoordinator;
  private readonly evolutionHudSyncCoordinator: PokemonBattleEvolutionHudSyncCoordinator;
  private readonly recoveryEvolutionQueue: PokemonEvolutionRecoveryPresentationQueue;

  constructor(
    scene: Phaser.Scene,
    pokemonSpriteLoader: PokemonSpriteLoader,
    sendBattleCommand: (input: PokemonBattleCommandInput) => void,
    sendBattleReplacement: (input: PokemonBattleReplacementInput) => void,
    sendMoveLearningDecision: (input: PokemonMoveLearningDecisionInput) => void,
    sendEvolutionDecision: (input: PokemonEvolutionDecisionInput) => void,
    onCompletionAcknowledged: (payload: PokemonBattleCompletedPayload) => void
  ) {
    this.pokemonSpriteLoader = pokemonSpriteLoader;
    this.sendBattleCommand = sendBattleCommand;
    this.sendBattleReplacement = sendBattleReplacement;
    this.sendMoveLearningDecision = sendMoveLearningDecision;
    this.onCompletionAcknowledged = onCompletionAcknowledged;
    this.audio = new WildBattleAudioController(scene);
    this.overlay = new BattleOverlay(
      scene,
      // FIGHT
      () => {
        this.handleFightSelected();
      },
      // POKÉMON
      () => {
        this.handlePokemonSelected();
      },
      // ITEM
      () => {
        this.handleItemSelected();
      },
      // ITEM BAG SELECTED
      (itemId) => {
        this.handleBagItemSelected(itemId);
      },
      // MOVE
      (moveId) => {
        this.handleMoveSelected(moveId);
      },
      // MOVE BACK
      () => {
        this.handleMoveBack();
      },
      // PARTY POKÉMON
      (pokemonIndex) => {
        this.handlePartyPokemonSelected(pokemonIndex);
      },
      // POKÉMON BACK
      () => {
        this.handlePokemonBack();
      },
      // ITEM BACK
      () => {
        this.handleItemBack();
      },
      // RUN
      () => {
        this.handleRunSelected();
      },
      // COMPLETION CONTINUE
      () => {
        this.handleCompletionAcknowledged();
      }
    );

    this.evolutionPresentationController = new PokemonEvolutionPresentationController({
      sendDecision: sendEvolutionDecision,
      requestDecision: (input) =>
        this.overlay.requestEvolutionDecision({
          ...input,
          pokemonName: this.getEvolutionPokemonDisplayName(input.pokemonInstanceId),
        }),
      hideDecision: () => {
        this.overlay.hideEvolutionDecision();
      },
      onIdle: () => {
        this.handleEvolutionPresentationIdle();
      },
      animateEvolution: (input) => this.overlay.animatePokemonEvolution(input),
    });

    this.evolutionHudSyncCoordinator = new PokemonBattleEvolutionHudSyncCoordinator({
      presentRequiredEvolution: (payload) =>
        this.evolutionPresentationController.presentRequiredEvolution(payload),
      getTrainerState: () => this.trainerState,
      syncTrainerPokemonAfterEvolution: (evolvedPokemon, trainerParty) => {
        let battlePresentationPokemon = evolvedPokemon;

        const activeBattlePayload = this.activeBattlePayload;

        if (activeBattlePayload) {
          const syncedBattle = syncAuthoritativeTrainerPokemonIntoBattleSnapshot(
            activeBattlePayload.battle,
            evolvedPokemon.pokemon
          );

          if (syncedBattle !== activeBattlePayload.battle) {
            this.activeBattlePayload = {
              battle: syncedBattle,
              localParticipantId: activeBattlePayload.localParticipantId,
            };

            const trainerParticipant = this.getLocalTrainerParticipant(
              syncedBattle,
              activeBattlePayload.localParticipantId
            );

            const syncedBattlePokemon = trainerParticipant?.pokemon.find(
              (state) => state.pokemon.instanceId === evolvedPokemon.pokemon.instanceId
            );

            if (syncedBattlePokemon) {
              battlePresentationPokemon = syncedBattlePokemon;
            }
          }
        }

        this.overlay.syncTrainerPokemonAfterEvolution(
          battlePresentationPokemon,
          trainerParty
        );
      },
      finishEvolutionCinematic: () => {
        this.overlay.finishPokemonEvolutionCinematic();
      },
    });

    this.recoveryEvolutionQueue = new PokemonEvolutionRecoveryPresentationQueue({
      presentRequiredEvolution: async (payload) => {
        /* Reconnect Evolution: no BattleInstance is required */
        this.overlay.show();

        try {
          await this.evolutionPresentationController.presentRequiredEvolution(payload);
        } finally {
          this.overlay.finishPokemonEvolutionCinematic();
          if (!this.isActive && this.recoveryEvolutionQueue.pendingCount === 1) {
            this.overlay.hide();
          }
        }
      },

      onError: (error, payload) => {
        console.error("[EvolutionRecovery] presentation failed", {
          pokemonInstanceId: payload.pokemonInstanceId,
          revision: payload.revision,
          error,
        });
      },
    });

    this.progressionPresentationCoordinator =
      new PokemonBattleProgressionPresentationCoordinator({
        presentMessage: (message, durationMs) =>
          this.overlay.presentMessage(message, durationMs),
        requestMoveLearningDecision: (input) =>
          this.overlay.requestMoveLearningDecision(input),
        hideMoveLearning: () => {
          this.overlay.hideMoveLearning();
        },
        sendMoveLearningDecision: (input) => {
          this.sendMoveLearningDecision(input);
        },
        waitForMoveLearningResponse: (pokemonInstanceId, revision) =>
          this.waitForMoveLearningResponse(pokemonInstanceId, revision),
        presentRequiredEvolution: async (payload) => {
          await this.evolutionHudSyncCoordinator.presentRequiredEvolution(payload);
        },
      });

    this.presentationQueue = new BattlePresentationQueue({
      presentEvent: (event, context) => this.presentBattleEvent(event, context),
      presentExperienceBatch: (events, context) =>
        this.presentBattleExperienceBatch(events, context),
      onTurnCompleted: async (payload) => {
        await this.handlePresentationTurnCompleted(payload);
      },
      onIdle: () => {
        this.handlePresentationQueueIdle();
      },
    });
  }

  public get isActive(): boolean {
    return this.activeBattlePayload !== undefined;
  }

  public get activeBattle(): PokemonBattleStartedPayload | undefined {
    return this.activeBattlePayload;
  }

  public get isBlockingGameplay(): boolean {
    return (
      this.isActive ||
      this.recoveryEvolutionQueue.isBusy ||
      this.evolutionPresentationController.isBusy
    );
  }

  public async start(payload: PokemonBattleStartedPayload): Promise<void> {
    const currentBattleId = this.activeBattlePayload?.battle.battleId;
    const nextBattleId = payload.battle.battleId;

    /*
     * Socket reconnects / retries can legitimately replay BATTLE_STARTED.
     * Re-render the authoritative snapshot, but never replay the intro or
     * reset an interaction that is already in progress for the same battle.
     */
    if (currentBattleId === nextBattleId) {
      if (this.interactionState === "completed") {
        console.warn("[BattleController] ignoring duplicate start for completed battle", {
          battleId: nextBattleId,
        });
        return;
      }

      this.activeBattlePayload = payload;
      this.overlay.renderBattle(payload.battle, payload.localParticipantId);
      return;
    }

    this.presentationQueue.clear();

    this.pendingStateUpdates.clear();
    this.pendingCompletion = undefined;
    this.committedCompletion = undefined;

    if (currentBattleId && currentBattleId !== nextBattleId) {
      console.warn("[BattleController] replacing active battle", {
        currentBattleId,
        nextBattleId,
      });
    }

    this.activeBattlePayload = payload;
    this.replacementPokemonIndexes = [];

    this.selectedItemId = undefined;

    this.setInteractionState("waiting-for-server");

    this.overlay.show();

    this.audio.stopAll();

    try {
      await this.ensureBattleSpritesLoaded(
        payload.battle,
        payload.localParticipantId
      );

      if (this.activeBattlePayload?.battle.battleId !== nextBattleId) {
        return;
      }

      this.overlay.renderBattle(payload.battle, payload.localParticipantId);

      await this.overlay.playBattleIntro(
        payload.battle,
        payload.localParticipantId,
      );

      if (this.activeBattlePayload?.battle.battleId !== nextBattleId) {
        return;
      }

      this.setInteractionState("action-menu");
    } catch (error) {
      console.error("[BattleController] failed to prepare battle presentation", error);
    }
  }

  public async applyReplacement(
    payload: PokemonBattleReplacementResolvedPayload
  ): Promise<void> {
    const currentBattle = this.activeBattlePayload;

    if (!currentBattle) {
      console.warn("[BattleController] replacement received without active battle");

      return;
    }

    if (currentBattle.battle.battleId !== payload.battle.battleId) {
      console.warn("[BattleController] replacement battle mismatch", {
        activeBattleId: currentBattle.battle.battleId,

        receivedBattleId: payload.battle.battleId,
      });

      return;
    }

    this.replacementPokemonIndexes = [];

    this.setInteractionState("waiting-for-server");

    try {
      await this.ensureBattleSpritesLoaded(
        payload.battle,
        currentBattle.localParticipantId
      );

      if (this.activeBattlePayload?.battle.battleId !== payload.battle.battleId) {
        return;
      }

      const trainerParticipant = this.getLocalTrainerParticipant(
        payload.battle,
        currentBattle.localParticipantId
      );

      const replacementPokemon = trainerParticipant
        ? trainerParticipant.pokemon[trainerParticipant.activePokemonIndex]
        : undefined;

      if (trainerParticipant && replacementPokemon) {
        const pokemonName = getPokemonDisplayName(replacementPokemon.pokemon);

        await this.overlay.presentMessage(
          `Go! ${pokemonName}!`,
          BATTLE_PRESENTATION_TIMING.forcedReplacementMessageMs
        );

        await this.overlay.animatePokemonSwitchIn(
          payload.battle,
          trainerParticipant.id,
          replacementPokemon.pokemon.instanceId
        );
      }

      /*
       * Only after presentation do we adopt
       * the authoritative replacement snapshot.
       */
      this.activeBattlePayload = {
        battle: payload.battle,
        localParticipantId: currentBattle.localParticipantId,
      };

      this.overlay.renderBattle(
        payload.battle,
        currentBattle.localParticipantId
      );

      this.setInteractionState("action-menu");

      console.log("[BattleController] replacement presentation applied", {
        battleId: payload.battle.battleId,

        nextTurnNumber: payload.nextTurnNumber,
      });
    } catch (error) {
      console.error(
        "[BattleController] failed to prepare replacement presentation",
        error
      );
    }
  }

  public complete(payload: PokemonBattleCompletedPayload): void {
    const currentBattle = this.activeBattlePayload;

    if (!currentBattle) {
      return;
    }

    if (currentBattle.battle.battleId !== payload.battleId) {
      console.warn("[BattleController] completed battle mismatch", {
        activeBattleId: currentBattle.battle.battleId,
        completedBattleId: payload.battleId,
      });

      return;
    }

    if (this.presentationQueue.isBusy || this.evolutionPresentationController.isBusy) {
      this.pendingCompletion = payload;
      return;
    }

    this.commitCompletion(payload);
  }

  public destroy(): void {
    this.presentationQueue.clear();

    this.pendingStateUpdates.clear();
    this.pendingCompletion = undefined;
    this.committedCompletion = undefined;

    this.selectedItemId = undefined;

    this.interactionState = "completed";
    this.replacementPokemonIndexes = [];
    this.activeBattlePayload = undefined;

    const pendingMoveLearningResponse = this.pendingMoveLearningResponse;
    this.pendingMoveLearningResponse = undefined;
    pendingMoveLearningResponse?.reject(
      new Error("Battle controller disposed before move-learning completed")
    );

    this.recoveryEvolutionQueue.clear();
    this.evolutionPresentationController.destroy();

    this.audio.destroy();

    this.overlay.destroy();
  }

  private async ensureBattleSpritesLoaded(
    battle: BattleInstance,
    localParticipantId: string
  ): Promise<void> {
    const trainerParticipant = this.getLocalTrainerParticipant(
      battle,
      localParticipantId
    );

    const opponentParticipant = battle.participants.find(
      (participant) => participant.id !== localParticipantId
    );

    if (!trainerParticipant || !opponentParticipant) {
      return;
    }

    const trainerPokemon =
      trainerParticipant.pokemon[trainerParticipant.activePokemonIndex];

    const opponentPokemon =
      opponentParticipant.pokemon[opponentParticipant.activePokemonIndex];

    if (!trainerPokemon || !opponentPokemon) {
      return;
    }

    await this.pokemonSpriteLoader.ensurePartyLoaded([
      trainerPokemon.pokemon,
      opponentPokemon.pokemon,
    ]);
  }

  private getLocalTrainerParticipant(
    battle: BattleInstance,
    localParticipantId = this.activeBattlePayload?.localParticipantId
  ) {
    if (!localParticipantId) {
      return undefined;
    }

    const participant = battle.participants.find(
      (candidate) => candidate.id === localParticipantId
    );

    return participant?.type === "trainer" ? participant : undefined;
  }

  public async applyStateUpdate(
    payload: PokemonBattleStateUpdatedPayload
  ): Promise<void> {
    const currentBattle = this.activeBattlePayload;

    if (!currentBattle) {
      console.warn("[BattleController] state update received without active battle");
      return;
    }

    if (currentBattle.battle.battleId !== payload.battle.battleId) {
      console.warn("[BattleController] state update battle mismatch", {
        activeBattleId: currentBattle.battle.battleId,
        receivedBattleId: payload.battle.battleId,
      });
      return;
    }

    if (this.presentationQueue.isBusy) {
      this.pendingStateUpdates.set(payload.resolvedTurnNumber, payload);
      return;
    }

    await this.commitStateUpdate(payload);
  }

  private setInteractionState(state: BattleClientInteractionState): void {
    this.interactionState = state;
    this.overlay.setInteractionState(state);
  }

  private handleMoveSelected(moveId: number): void {
    if (this.interactionState !== "move-selection") {
      return;
    }

    const payload = this.activeBattlePayload;

    if (!payload) {
      return;
    }

    const trainerParticipant = this.getLocalTrainerParticipant(
      payload.battle,
      payload.localParticipantId
    );

    if (!trainerParticipant) {
      return;
    }

    const activePokemon =
      trainerParticipant.pokemon[trainerParticipant.activePokemonIndex];

    if (!activePokemon) {
      return;
    }

    const instanceMove = activePokemon.pokemon.moves.find(
      (move) => move.moveId === moveId
    );

    if (!instanceMove || instanceMove.currentPp <= 0) {
      return;
    }

    /*
     * Bloqueamos ANTES del emit.
     * Evita:
     * - double click
     * - command spam
     * - duplicate turn submission
     */
    this.setInteractionState("waiting-for-server");

    try {
      this.sendBattleCommand({
        battleId: payload.battle.battleId,

        action: {
          type: "use-move",
          moveId,
        },
      });

      console.log("[BattleController] move submitted", {
        battleId: payload.battle.battleId,
        moveId,
      });
    } catch (error) {
      this.setInteractionState("move-selection");
      console.error("[BattleController] failed to submit move", error);
    }
  }

  private handleForcedReplacementSelected(pokemonIndex: number): void {
    if (this.interactionState !== "replacement-required") {
      return;
    }

    const payload = this.activeBattlePayload;

    if (!payload) {
      return;
    }

    if (!this.replacementPokemonIndexes.includes(pokemonIndex)) {
      console.warn("[BattleController] invalid replacement selection", {
        pokemonIndex,
        replacementPokemonIndexes: this.replacementPokemonIndexes,
      });

      return;
    }

    const trainer = this.getLocalTrainerParticipant(
      payload.battle,
      payload.localParticipantId
    );

    if (!trainer) {
      return;
    }

    const pokemonState = trainer.pokemon[pokemonIndex];

    if (
      !pokemonState ||
      pokemonIndex === trainer.activePokemonIndex ||
      pokemonState.currentHp <= 0
    ) {
      return;
    }

    /* Bloqueamos ANTES del emit. */
    this.setInteractionState("waiting-for-server");

    try {
      this.sendBattleReplacement({
        battleId: payload.battle.battleId,
        replacementPokemonIndex: pokemonIndex,
      });
    } catch (error) {
      this.setInteractionState("replacement-required");
      console.error("[BattleController] failed to submit replacement", error);
    }
  }

  private handleCompletionAcknowledged(): void {
    if (this.interactionState !== "completed") {
      return;
    }
    if (!this.activeBattlePayload || !this.committedCompletion) {
      return;
    }

    const completion = this.committedCompletion;

    this.presentationQueue.clear();

    this.pendingStateUpdates.clear();
    this.pendingCompletion = undefined;
    this.committedCompletion = undefined;

    this.replacementPokemonIndexes = [];
    this.selectedItemId = undefined;
    this.activeBattlePayload = undefined;

    this.audio.stopAll();

    this.overlay.hide();

    this.onCompletionAcknowledged(completion);
  }

  private mapServerInteractionState(
    state: PokemonBattleStateUpdatedPayload["interactionState"]
  ): BattleClientInteractionState {
    switch (state) {
      case "selecting-action":
        return "action-menu";

      case "replacement-required":
        return "replacement-required";
    }
  }

  private handleFightSelected(): void {
    if (this.interactionState !== "action-menu") {
      return;
    }

    const payload = this.activeBattlePayload;

    if (!payload) {
      return;
    }

    const trainer = this.getLocalTrainerParticipant(
      payload.battle,
      payload.localParticipantId
    );

    const activePokemon = trainer
      ? trainer.pokemon[trainer.activePokemonIndex]
      : undefined;

    if (!activePokemon) {
      return;
    }

    const hasUsableMove = activePokemon.pokemon.moves.some(
      (move) => move.currentPp > 0
    );

    if (!hasUsableMove) {
      this.setInteractionState("waiting-for-server");

      try {
        this.sendBattleCommand({
          battleId: payload.battle.battleId,
          action: { type: "struggle" },
        });
      } catch (error) {
        this.setInteractionState("action-menu");
        console.error("[BattleController] failed to submit Struggle", error);
      }

      return;
    }

    this.setInteractionState("move-selection");
  }

  private handlePokemonSelected(): void {
    if (this.interactionState !== "action-menu") {
      return;
    }
    const payload = this.activeBattlePayload;
    if (!payload) {
      return;
    }
    this.overlay.setVoluntaryPokemonOptions(payload.battle);
    this.setInteractionState("pokemon-selection");
  }

  private handleRunSelected(): void {
    if (this.interactionState !== "action-menu") {
      return;
    }

    const payload = this.activeBattlePayload;

    if (!payload) {
      return;
    }

    const runDecision = evaluatePokemonBattleRunRule(payload.battle);

    if (!runDecision.allowed) {
      void this.presentBattleRuleRejection(
        payload.battle.battleId,
        runDecision.reason,
        "action-menu",
      );
      return;
    }

    this.setInteractionState("waiting-for-server");

    try {
      this.sendBattleCommand({
        battleId: payload.battle.battleId,
        action: {
          type: "run",
        },
      });
    } catch (error) {
      this.setInteractionState("action-menu");

      console.error("[BattleController] failed to submit run", error);
    }
  }

  private handleMoveBack(): void {
    if (this.interactionState !== "move-selection") {
      return;
    }
    this.setInteractionState("action-menu");
  }

  private handlePokemonBack(): void {
    switch (this.interactionState) {
      case "pokemon-selection":
        this.setInteractionState("action-menu");
        return;

      case "item-target-selection":
        this.selectedItemId = undefined;
        if (this.trainerState) {
          const payload = this.activeBattlePayload;
          if (payload) {
            this.overlay.setBagInventory(payload.battle, this.trainerState.inventory);
          }
        }
        this.setInteractionState("item-selection");
        return;

      default:
        return;
    }
  }

  private handlePartyPokemonSelected(pokemonIndex: number): void {
    switch (this.interactionState) {
      case "pokemon-selection":
        this.handleVoluntaryPokemonSelected(pokemonIndex);
        return;

      case "replacement-required":
        this.handleForcedReplacementSelected(pokemonIndex);
        return;

      case "item-target-selection":
        this.handleItemTargetSelected(pokemonIndex);
        return;

      default:
        return;
    }
  }

  private handleVoluntaryPokemonSelected(pokemonIndex: number): void {
    if (this.interactionState !== "pokemon-selection") {
      return;
    }

    const payload = this.activeBattlePayload;

    if (!payload) {
      return;
    }

    const trainer = this.getLocalTrainerParticipant(
      payload.battle,
      payload.localParticipantId
    );

    if (!trainer) {
      return;
    }

    const activePokemon = trainer.pokemon[trainer.activePokemonIndex];

    if (!activePokemon) {
      return;
    }

    /*
     * Si el active está fainted, esto NO es voluntary switch.
     * El server deberá haber entrado en replacement-required.
     */
    if (activePokemon.currentHp <= 0) {
      return;
    }

    const pokemonState = trainer.pokemon[pokemonIndex];

    if (!pokemonState) {
      return;
    }

    //  No podemos elegir al mismo Pokémon que ya está activo.
    if (pokemonIndex === trainer.activePokemonIndex) {
      return;
    }

    // No podemos elegir un Pokémon fainted.
    if (pokemonState.currentHp <= 0) {
      return;
    }

    // Lock ANTES del emit.
    this.setInteractionState("waiting-for-server");

    try {
      this.sendBattleCommand({
        battleId: payload.battle.battleId,
        action: {
          type: "switch-pokemon",
          pokemonIndex,
        },
      });
    } catch (error) {
      this.overlay.setVoluntaryPokemonOptions(payload.battle);
      this.setInteractionState("pokemon-selection");
      console.error("[BattleController] failed to submit voluntary switch", error);
    }
  }

  public enqueueTurnPresentation(payload: PokemonBattleTurnResolvedPayload): void {
    const currentBattle = this.activeBattlePayload;

    if (!currentBattle) {
      console.warn(
        "[BattleController] turn presentation received without active battle",
        {
          battleId: payload.battleId,
          turnNumber: payload.turnNumber,
        }
      );
      return;
    }

    if (currentBattle.battle.battleId !== payload.battleId) {
      console.warn("[BattleController] turn presentation battle mismatch", {
        activeBattleId: currentBattle.battle.battleId,
        receivedBattleId: payload.battleId,
        turnNumber: payload.turnNumber,
      });
      return;
    }

    this.presentationQueue.enqueue(payload);
  }

  private async presentBattleExperienceBatch(
    events: readonly BattleExperienceGainedPresentationEvent[],
    context: BattlePresentationEventBatchContext
  ): Promise<void> {
    const activeBattle = this.activeBattlePayload?.battle;

    if (!activeBattle) {
      return;
    }

    if (activeBattle.battleId !== context.battleId) {
      console.warn("[BattleController] EXP batch battle mismatch", {
        activeBattleId: activeBattle.battleId,
        receivedBattleId: context.battleId,
        turnNumber: context.turnNumber,
      });
      return;
    }

    await this.waitForPresentationDelay(
      BATTLE_PRESENTATION_TIMING.experienceRewardLeadInMs
    );

    await Promise.all([
      this.overlay.animatePartyExperienceGainBatch(activeBattle, events),
      this.overlay.presentMessage(
        "Your party gained EXP!",
        BATTLE_PRESENTATION_TIMING.experienceGainedMessageMs
      ),
    ]);
  }

  private async presentBattleEvent(
    event: BattlePresentationEvent,
    context: BattlePresentationEventContext
  ): Promise<void> {
    const activeBattle = this.activeBattlePayload?.battle;

    if (!activeBattle) {
      return;
    }

    if (activeBattle.battleId !== context.battleId) {
      console.warn("[BattleController] presentation event battle mismatch", {
        activeBattleId: activeBattle.battleId,
        receivedBattleId: context.battleId,
        turnNumber: context.turnNumber,
      });
      return;
    }

    if (event.type === "pokemon-switched") {
      const followsFaint =
        context.previousEvent?.type === "pokemon-fainted" &&
        context.previousEvent.participantId === event.participantId &&
        context.previousEvent.pokemonInstanceId ===
          event.previousPokemonInstanceId;

      /*
       * A forced replacement after faint must not "withdraw" an already
       * fainted Pokémon. Voluntary switches keep the normal switch-out animation.
       */
      if (!followsFaint) {
        await this.overlay.animatePokemonSwitchOut(
          activeBattle,
          event.participantId,
          event.previousPokemonInstanceId
        );
      } else {
        await this.waitForPresentationDelay(
          BATTLE_PRESENTATION_TIMING.opponentReplacementLeadInMs
        );
      }

      const message = formatBattlePresentationMessage(
        activeBattle,
        event,
        this.activeBattlePayload?.localParticipantId
      );

      if (message) {
        await this.overlay.presentMessage(
          message,
          getBattlePresentationMessageDuration(event)
        );
      }

      await this.overlay.animatePokemonSwitchIn(
        activeBattle,
        event.participantId,
        event.currentPokemonInstanceId
      );
      return;
    }

    if (event.type === "pokemon-fainted") {
      const message = formatBattlePresentationMessage(
        activeBattle,
        event,
        this.activeBattlePayload?.localParticipantId
      );

      if (message) {
        await this.overlay.presentMessage(
          message,
          getBattlePresentationMessageDuration(event)
        );
      }

      await this.overlay.animatePokemonFaint(
        activeBattle,
        event.participantId,
        event.pokemonInstanceId
      );
      return;
    }

    if (event.type === "capture-failed" || event.type === "capture-succeeded") {
      const captured = event.type === "capture-succeeded";

      await this.overlay.animatePokemonCapture(
        activeBattle,
        event.itemId,
        event.wildParticipantId,
        event.pokemonInstanceId,
        event.shakeCount,
        captured,
        {
          onContained: () => {
            this.audio.playCaptureContained();
          },
          onSuccess: () => {
            this.audio.playCaptureSuccess();
          },
          onFailure: () => {
            this.audio.playCaptureFailed();
          },
        }
      );

      const message = formatBattlePresentationMessage(
        activeBattle,
        event,
        this.activeBattlePayload?.localParticipantId
      );

      if (message) {
        await this.overlay.presentMessage(
          message,

          getBattlePresentationMessageDuration(event)
        );
      }

      return;
    }

    if (event.type === "hp-restored" && event.appliedHealing > 0) {
      const message = formatBattlePresentationMessage(
        activeBattle,
        event,
        this.activeBattlePayload?.localParticipantId
      );

      if (message) {
        await this.overlay.presentMessage(
          message,
          getBattlePresentationMessageDuration(event)
        );
      }

      await this.overlay.animatePokemonHp(
        activeBattle,
        event.participantId,
        event.pokemonInstanceId,
        event.previousHp,
        event.currentHp
      );

      return;
    }

    if (event.type === "damage-applied" && event.appliedDamage > 0) {
      await Promise.all([
        this.overlay.animatePokemonHit(
          activeBattle,
          event.participantId,
          event.pokemonInstanceId
        ),
        this.overlay.animatePokemonHp(
          activeBattle,
          event.participantId,
          event.pokemonInstanceId,
          event.previousHp,
          event.currentHp
        ),
      ]);
    }

    if (event.type === "experience-gained") {
      const message = formatBattlePresentationMessage(
        activeBattle,
        event,
        this.activeBattlePayload?.localParticipantId
      );

      await this.waitForPresentationDelay(
        BATTLE_PRESENTATION_TIMING.experienceRewardLeadInMs
      );

      await Promise.all([
        this.overlay.animatePokemonExperienceGain(
          activeBattle,
          event.participantId,
          event.pokemonInstanceId,
          event.gainedExperience,
          event.previousExperience,
          event.currentExperience,
          event.previousLevel,
          event.currentLevel
        ),
        message
          ? this.overlay.presentMessage(
              message,
              getBattlePresentationMessageDuration(event)
            )
          : Promise.resolve(),
      ]);
      return;
    }

    if (event.type === "pokemon-leveled-up") {
      const message = formatBattlePresentationMessage(
        activeBattle,
        event,
        this.activeBattlePayload?.localParticipantId
      );

      await Promise.all([
        this.overlay.animatePokemonLevelUp(
          activeBattle,
          event.participantId,
          event.pokemonInstanceId,
          event.currentLevel
        ),
        message
          ? this.overlay.presentMessage(
              message,
              getBattlePresentationMessageDuration(event)
            )
          : Promise.resolve(),
      ]);
      return;
    }

    if (event.type === "move-learning-required") {
      await this.presentMoveLearningWorkflow(activeBattle, event);
      return;
    }

    if (event.type === "evolution-required") {
      await this.evolutionHudSyncCoordinator.presentRequiredEvolution(event);
      return;
    }

    const message = formatBattlePresentationMessage(
      activeBattle,
      event,
      this.activeBattlePayload?.localParticipantId
    );
    if (!message) {
      return;
    }
    await this.overlay.presentMessage(
      message,
      getBattlePresentationMessageDuration(event)
    );
  }

  private async handlePresentationTurnCompleted(
    payload: PokemonBattleTurnResolvedPayload
  ): Promise<void> {
    const pendingState = this.pendingStateUpdates.get(payload.turnNumber);

    if (!pendingState) {
      return;
    }

    if (pendingState.battle.battleId !== payload.battleId) {
      console.warn("[BattleController] pending state battle mismatch", {
        presentationBattleId: payload.battleId,
        stateBattleId: pendingState.battle.battleId,
        turnNumber: payload.turnNumber,
      });
      return;
    }

    this.pendingStateUpdates.delete(payload.turnNumber);
    await this.commitStateUpdate(pendingState);
  }

  private handleEvolutionPresentationIdle(): void {
    if (this.presentationQueue.isBusy) {
      return;
    }

    this.handlePresentationQueueIdle();
  }

  private handlePresentationQueueIdle(): void {
    if (this.evolutionPresentationController.isBusy) {
      return;
    }
    if (!this.pendingCompletion) {
      return;
    }
    const payload = this.pendingCompletion;
    this.pendingCompletion = undefined;
    this.commitCompletion(payload);
  }

  private async commitStateUpdate(
    payload: PokemonBattleStateUpdatedPayload
  ): Promise<void> {
    const currentBattle = this.activeBattlePayload;

    if (!currentBattle) {
      return;
    }

    if (currentBattle.battle.battleId !== payload.battle.battleId) {
      console.warn("[BattleController] cannot commit state for another battle", {
        activeBattleId: currentBattle.battle.battleId,
        receivedBattleId: payload.battle.battleId,
      });

      return;
    }

    this.activeBattlePayload = {
      battle: payload.battle,
      localParticipantId: currentBattle.localParticipantId,
    };

    this.replacementPokemonIndexes =
      payload.interactionState === "replacement-required"
        ? [...payload.replacementPokemonIndexes]
        : [];

    this.selectedItemId = undefined;
    this.setInteractionState("waiting-for-server");

    try {
      await this.ensureBattleSpritesLoaded(
        payload.battle,
        currentBattle.localParticipantId
      );

      if (this.activeBattlePayload?.battle.battleId !== payload.battle.battleId) {
        return;
      }

      this.overlay.renderBattle(
        payload.battle,
        currentBattle.localParticipantId
      );

      if (payload.interactionState === "replacement-required") {
        this.overlay.setReplacementOptions(
          payload.battle,
          this.replacementPokemonIndexes
        );
      }

      this.setInteractionState(this.mapServerInteractionState(payload.interactionState));
    } catch (error) {
      console.error("[BattleController] failed to commit battle state", error);
    }
  }

  private commitCompletion(payload: PokemonBattleCompletedPayload): void {
    const currentBattle = this.activeBattlePayload;

    if (!currentBattle) {
      return;
    }

    if (currentBattle.battle.battleId !== payload.battleId) {
      return;
    }

    this.selectedItemId = undefined;
    this.committedCompletion = payload;
    this.setInteractionState("completed");
    this.replacementPokemonIndexes = [];
    this.overlay.showCompletion(payload.outcome);
    this.audio.playBattleOutcome(payload.outcome);
  }

  public setTrainerState(trainerState: PokemonTrainerState): void {
    this.trainerState = trainerState;

    if (this.interactionState === "item-selection") {
      const payload = this.activeBattlePayload;
      if (payload) {
        this.overlay.setBagInventory(payload.battle, trainerState.inventory);
      }
    }
  }

  private handleItemSelected(): void {
    if (this.interactionState !== "action-menu") {
      return;
    }

    const payload = this.activeBattlePayload;
    if (!payload || !this.trainerState) {
      return;
    }

    this.overlay.setBagInventory(payload.battle, this.trainerState.inventory);
    this.setInteractionState("item-selection");
  }

  private handleItemBack(): void {
    if (this.interactionState !== "item-selection") {
      return;
    }
    this.selectedItemId = undefined;
    this.setInteractionState("action-menu");
  }

  private getTrainerItemTargetPokemonIndexes(
    battle: BattleInstance,
    itemId: PokemonItemId
  ): number[] {
    const trainer = this.getLocalTrainerParticipant(battle);

    if (!trainer) {
      return [];
    }

    const item = getPokemonItem(itemId);
    const effect = item.effect;

    if (!effect || item.battleTarget !== "trainer-pokemon") {
      return [];
    }

    return trainer.pokemon
      .map((pokemonState, pokemonIndex) => ({
        pokemonState,
        pokemonIndex,
      }))
      .filter(({ pokemonState }) => {
        switch (effect.type) {
          case "heal-hp": {
            if (pokemonState.currentHp <= 0) {
              return false;
            }

            const maxHp = calculatePokemonMaxHp(pokemonState.pokemon);
            return pokemonState.currentHp < maxHp;
          }

          case "revive":
            return pokemonState.currentHp <= 0;

          default:
            return false;
        }
      })
      .map(({ pokemonIndex }) => pokemonIndex);
  }

  private handleBagItemSelected(itemId: PokemonItemId): void {
    if (this.interactionState !== "item-selection") {
      return;
    }

    const payload = this.activeBattlePayload;
    const trainerState = this.trainerState;
    if (!payload || !trainerState) {
      return;
    }

    const quantity = getPokemonInventoryItemQuantity(trainerState.inventory, itemId);
    if (quantity <= 0) {
      return;
    }

    const itemDecision = evaluatePokemonBattleItemRule(payload.battle, itemId);

    if (!itemDecision.allowed) {
      void this.presentBattleRuleRejection(
        payload.battle.battleId,
        itemDecision.reason,
        "item-selection",
      );
      return;
    }

    const item = getPokemonItem(itemId);

    const effect = item.effect;
    if (!effect) {
      return;
    }

    /* CAPTURE ITEM */
    if (item.battleTarget === "wild-active" && item.effect.type === "capture") {
      this.selectedItemId = itemId;
      this.setInteractionState("waiting-for-server");

      try {
        this.sendBattleCommand({
          battleId: payload.battle.battleId,
          action: {
            type: "use-item",
            itemId,
            target: {
              type: "wild-active",
            },
          },
        });
      } catch (error) {
        this.selectedItemId = undefined;
        this.overlay.setBagInventory(payload.battle, trainerState.inventory);
        this.setInteractionState("item-selection");
        console.error("[BattleController] failed to submit capture item", error);
      }

      return;
    }

    /* TRAINER MEDICINE ITEM */
    if (
      item.battleTarget !== "trainer-pokemon" ||
      (effect.type !== "heal-hp" && effect.type !== "revive")
    ) {
      return;
    }

    this.selectedItemId = itemId;

    const selectablePokemonIndexes = this.getTrainerItemTargetPokemonIndexes(
      payload.battle,
      itemId
    );

    this.overlay.setItemTargetOptions(payload.battle, selectablePokemonIndexes);

    this.setInteractionState("item-target-selection");
  }

  private handleItemTargetSelected(pokemonIndex: number): void {
    if (this.interactionState !== "item-target-selection") {
      return;
    }

    const payload = this.activeBattlePayload;
    const itemId = this.selectedItemId;
    if (!payload || !itemId) {
      return;
    }

    const trainer = this.getLocalTrainerParticipant(
      payload.battle,
      payload.localParticipantId
    );
    if (!trainer) {
      return;
    }

    const pokemonState = trainer.pokemon[pokemonIndex];
    if (!pokemonState) {
      return;
    }
    const item = getPokemonItem(itemId);
    const effect = item.effect;

    if (!effect || item.battleTarget !== "trainer-pokemon") {
      return;
    }

    switch (effect.type) {
      case "heal-hp": {
        if (pokemonState.currentHp <= 0) {
          return;
        }

        const maxHp = calculatePokemonMaxHp(pokemonState.pokemon);

        if (pokemonState.currentHp >= maxHp) {
          return;
        }
        break;
      }

      case "revive": {
        if (pokemonState.currentHp > 0) {
          return;
        }
        break;
      }

      default:
        return;
    }

    this.setInteractionState("waiting-for-server");

    try {
      this.sendBattleCommand({
        battleId: payload.battle.battleId,
        action: {
          type: "use-item",
          itemId,
          target: {
            type: "trainer-pokemon",
            pokemonInstanceId: pokemonState.pokemon.instanceId,
          },
        },
      });
    } catch (error) {
      const selectablePokemonIndexes = this.getTrainerItemTargetPokemonIndexes(
        payload.battle,
        itemId
      );
      this.overlay.setItemTargetOptions(payload.battle, selectablePokemonIndexes);
      this.setInteractionState("item-target-selection");
      console.error("[BattleController] failed to submit item", error);
    }
  }

  private async presentBattleRuleRejection(
    battleId: string,
    reason: PokemonBattleRuleRejectionReason,
    restoreState: BattleClientInteractionState,
  ): Promise<void> {
    await this.overlay.presentMessage(
      formatPokemonBattleRuleRejectionMessage(reason),
      1100,
    );

    if (
      this.activeBattlePayload?.battle.battleId === battleId &&
      this.interactionState === restoreState
    ) {
      this.overlay.setInteractionState(restoreState);
    }
  }

  private pendingMoveLearningResponse?: {
    readonly pokemonInstanceId: string;
    readonly revision: number;
    readonly resolve: (payload: PokemonMoveLearningResolvedPayload) => void;
    readonly reject: (error: Error) => void;
  };

  public applyMoveLearningResolved(payload: PokemonMoveLearningResolvedPayload): void {
    const pending = this.pendingMoveLearningResponse;

    if (!pending) {
      return;
    }

    if (
      pending.pokemonInstanceId !== payload.pokemonInstanceId ||
      pending.revision !== payload.resolvedRevision
    ) {
      return;
    }

    this.pendingMoveLearningResponse = undefined;

    pending.resolve(payload);
  }

  public applyMoveLearningError(payload: PokemonMoveLearningErrorPayload): void {
    const pending = this.pendingMoveLearningResponse;

    if (!pending) {
      return;
    }

    if (
      payload.pokemonInstanceId !== null &&
      payload.pokemonInstanceId !== pending.pokemonInstanceId
    ) {
      return;
    }

    this.pendingMoveLearningResponse = undefined;

    pending.reject(new Error(payload.message));
  }

  public applyEvolutionResolved(payload: PokemonEvolutionResolvedPayload): void {
    this.evolutionPresentationController.applyResolved(payload);
  }

  public applyEvolutionError(payload: PokemonEvolutionErrorPayload): void {
    console.error("[Evolution] authoritative decision failed", {
      pokemonInstanceId: payload.pokemonInstanceId,

      revision: payload.revision,

      code: payload.code,

      message: payload.message,
    });

    this.evolutionPresentationController.applyError(payload);
  }

  private async presentMoveLearningWorkflow(
    battle: BattleInstance,
    event: BattleMoveLearningRequiredEvent
  ): Promise<void> {
    const participant = battle.participants.find(
      (candidate) => candidate.id === event.participantId
    );

    const pokemonState = participant?.pokemon.find(
      (candidate) => candidate.pokemon.instanceId === event.pokemonInstanceId
    );

    const pokemonName = pokemonState
      ? getPokemonDisplayName(pokemonState.pokemon)
      : "Pokémon";

    await this.progressionPresentationCoordinator.presentMoveLearningWorkflow({
      pokemonName,
      event,
    });
  }

  private waitForMoveLearningResponse(
    pokemonInstanceId: string,
    revision: number
  ): Promise<PokemonMoveLearningResolvedPayload> {
    if (this.pendingMoveLearningResponse) {
      throw new Error("Another move-learning network request is already pending");
    }

    return new Promise((resolve, reject) => {
      this.pendingMoveLearningResponse = {
        pokemonInstanceId,
        revision,
        resolve,
        reject,
      };
    });
  }

  private waitForPresentationDelay(durationMs: number): Promise<void> {
    if (durationMs <= 0) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      window.setTimeout(resolve, durationMs);
    });
  }

  public applyEvolutionRequired(payload: PokemonEvolutionRequiredPayload): void {
    /* Standalone EVOLUTION_REQUIRED is reserved for reconnect / durable pending recovery */
    if (this.isActive) {
      console.warn(
        "[BattleController] ignoring standalone Evolution during active Battle",
        {
          battleId: this.activeBattlePayload?.battle.battleId,
          pokemonInstanceId: payload.pokemonInstanceId,
          revision: payload.revision,
        }
      );

      return;
    }

    this.recoveryEvolutionQueue.enqueue(payload);
  }

  private getEvolutionPokemonDisplayName(pokemonInstanceId: string): string {
    const trainerPokemon = this.trainerState?.party.pokemon.find(
      (pokemon) => pokemon.instanceId === pokemonInstanceId
    );

    if (trainerPokemon) {
      return getPokemonDisplayName(trainerPokemon);
    }

    const activeBattlePayload = this.activeBattlePayload;
    const trainerParticipant = activeBattlePayload
      ? this.getLocalTrainerParticipant(
          activeBattlePayload.battle,
          activeBattlePayload.localParticipantId
        )
      : undefined;

    const battlePokemon = trainerParticipant?.pokemon.find(
      (pokemonState) => pokemonState.pokemon.instanceId === pokemonInstanceId
    );

    if (battlePokemon) {
      return getPokemonDisplayName(battlePokemon.pokemon);
    }

    return "Pokémon";
  }
}
