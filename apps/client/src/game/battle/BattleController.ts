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
} from "@cesar-mmo/shared";

import { PokemonSpriteLoader } from "../pokemon/PokemonSpriteLoader";

import { BattleOverlay } from "./ui/BattleOverlay";

import type { BattleClientInteractionState } from "./battle-client.types";

import {
  BattlePresentationQueue,
  type BattlePresentationEventContext,
} from "./presentation/BattlePresentationQueue";

import { formatBattlePresentationMessage } from "./presentation/battle-presentation-message";
import {
  BATTLE_PRESENTATION_TIMING,
  getBattlePresentationMessageDuration,
} from "./presentation/battle-presentation-timing";
import { getPokemonDisplayName } from "../pokemon/pokemon-presentation.utils";

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

  private interactionState: BattleClientInteractionState = "completed";
  private readonly sendBattleCommand: (input: PokemonBattleCommandInput) => void;
  private readonly sendBattleReplacement: (input: PokemonBattleReplacementInput) => void;
  private replacementPokemonIndexes: readonly number[] = [];

  constructor(
    scene: Phaser.Scene,
    pokemonSpriteLoader: PokemonSpriteLoader,
    sendBattleCommand: (input: PokemonBattleCommandInput) => void,
    sendBattleReplacement: (input: PokemonBattleReplacementInput) => void
  ) {
    this.pokemonSpriteLoader = pokemonSpriteLoader;
    this.sendBattleCommand = sendBattleCommand;
    this.sendBattleReplacement = sendBattleReplacement;
    this.overlay = new BattleOverlay(
      scene,
      () => {
        this.handleFightSelected();
      },
      () => {
        this.handlePokemonSelected();
      },
      (moveId) => {
        this.handleMoveSelected(moveId);
      },
      () => {
        this.handleMoveBack();
      },
      (pokemonIndex) => {
        this.handlePartyPokemonSelected(pokemonIndex);
      },
      () => {
        this.handlePokemonBack();
      },
      () => {
        this.handleCompletionAcknowledged();
      }
    );

    this.presentationQueue = new BattlePresentationQueue({
      presentEvent: (event, context) => this.presentBattleEvent(event, context),
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

  public async start(payload: PokemonBattleStartedPayload): Promise<void> {
    this.presentationQueue.clear();

    this.pendingStateUpdates.clear();
    this.pendingCompletion = undefined;

    const currentBattleId = this.activeBattlePayload?.battle.battleId;
    const nextBattleId = payload.battle.battleId;

    if (currentBattleId && currentBattleId !== nextBattleId) {
      console.warn("[BattleController] replacing active battle", {
        currentBattleId,
        nextBattleId,
      });
    }

    this.activeBattlePayload = payload;
    this.replacementPokemonIndexes = [];
    this.setInteractionState("waiting-for-server");

    this.overlay.show();

    try {
      await this.ensureBattleSpritesLoaded(payload.battle);

      if (this.activeBattlePayload?.battle.battleId !== nextBattleId) {
        return;
      }

      this.overlay.renderBattle(payload.battle);
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
      await this.ensureBattleSpritesLoaded(payload.battle);

      if (this.activeBattlePayload?.battle.battleId !== payload.battle.battleId) {
        return;
      }

      const trainerParticipant = payload.battle.participants.find(
        (participant) => participant.type === "trainer"
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
      };

      this.overlay.renderBattle(payload.battle);

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

    if (this.presentationQueue.isBusy) {
      this.pendingCompletion = payload;
      return;
    }

    this.commitCompletion(payload);
  }

  public destroy(): void {
    this.presentationQueue.clear();

    this.pendingStateUpdates.clear();
    this.pendingCompletion = undefined;

    this.interactionState = "completed";
    this.replacementPokemonIndexes = [];
    this.activeBattlePayload = undefined;

    this.overlay.destroy();
  }

  private async ensureBattleSpritesLoaded(battle: BattleInstance): Promise<void> {
    const trainerParticipant = battle.participants.find(
      (participant) => participant.type === "trainer"
    );

    const wildParticipant = battle.participants.find(
      (participant) => participant.type === "wild"
    );

    if (!trainerParticipant || !wildParticipant) {
      return;
    }

    const trainerPokemon =
      trainerParticipant.pokemon[trainerParticipant.activePokemonIndex];

    const wildPokemon = wildParticipant.pokemon[wildParticipant.activePokemonIndex];

    if (!trainerPokemon || !wildPokemon) {
      return;
    }

    await this.pokemonSpriteLoader.ensurePartyLoaded([
      trainerPokemon.pokemon,
      wildPokemon.pokemon,
    ]);
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

    const trainerParticipant = payload.battle.participants.find(
      (participant) => participant.type === "trainer"
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

    const trainer = payload.battle.participants.find(
      (participant) => participant.type === "trainer"
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
    if (!this.activeBattlePayload) {
      return;
    }

    this.presentationQueue.clear();

    this.pendingStateUpdates.clear();
    this.pendingCompletion = undefined;

    //  Aqui si liberamos Battle.
    this.replacementPokemonIndexes = [];
    this.activeBattlePayload = undefined;
    this.overlay.hide();
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

  private handleMoveBack(): void {
    if (this.interactionState !== "move-selection") {
      return;
    }
    this.setInteractionState("action-menu");
  }

  private handlePokemonBack(): void {
    if (this.interactionState !== "pokemon-selection") {
      return;
    }
    this.setInteractionState("action-menu");
  }

  private handlePartyPokemonSelected(pokemonIndex: number): void {
    switch (this.interactionState) {
      case "pokemon-selection":
        this.handleVoluntaryPokemonSelected(pokemonIndex);
        return;

      case "replacement-required":
        this.handleForcedReplacementSelected(pokemonIndex);
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

    const trainer = payload.battle.participants.find(
      (participant) => participant.type === "trainer"
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

  private async presentBattleEvent(
    event: BattlePresentationEvent,
    context: BattlePresentationEventContext
  ): Promise<void> {
    console.log("[BattlePresentation] event", {
      type: event.type,
      event,
      turnNumber: context.turnNumber,
      eventIndex: context.eventIndex,
    });
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
      await this.overlay.animatePokemonSwitchOut(
        activeBattle,
        event.participantId,
        event.previousPokemonInstanceId
      );

      const message = formatBattlePresentationMessage(activeBattle, event);

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
      const message = formatBattlePresentationMessage(activeBattle, event);

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

    const message = formatBattlePresentationMessage(activeBattle, event);
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

  private handlePresentationQueueIdle(): void {
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
    };

    this.replacementPokemonIndexes =
      payload.interactionState === "replacement-required"
        ? [...payload.replacementPokemonIndexes]
        : [];

    this.setInteractionState("waiting-for-server");

    try {
      await this.ensureBattleSpritesLoaded(payload.battle);

      if (this.activeBattlePayload?.battle.battleId !== payload.battle.battleId) {
        return;
      }

      this.overlay.renderBattle(payload.battle);

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

    this.setInteractionState("completed");
    this.replacementPokemonIndexes = [];
    this.overlay.showCompletion(payload.outcome);
  }
}
