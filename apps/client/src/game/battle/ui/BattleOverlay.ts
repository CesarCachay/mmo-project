import Phaser from "phaser";

import type {
  BattleInstance,
  PokemonBattleCompletedPayload,
  PokemonInventory,
  PokemonItemId,
  PokemonMoveLearningDecision,
  BattlePresentationEvent,
  PokemonEvolutionDecision,
  BattlePokemonState,
} from "@cesar-mmo/shared";

import {
  evaluatePokemonBattleRunRule,
} from "@cesar-mmo/shared";

import { BattleDomRoot } from "./modern/BattleDomRoot";
import { ModernBattleStage } from "./modern/ModernBattleStage";
import { ModernBattleEffectsLayer } from "./modern/ModernBattleEffectsLayer";
import { ModernBattleMoveVfxLayer } from "./modern/ModernBattleMoveVfxLayer";
import { ModernBattlePendingIndicator } from "./modern/ModernBattlePendingIndicator";

import { ModernBattlePokemonHud } from "./modern/ModernBattlePokemonHud";
import { ModernBattleMovePanel } from "./modern/ModernBattleMovePanel";
import { ModernBattleReplacementPanel } from "./modern/ModernBattleReplacementPanel";
import { ModernBattleCompletionPanel } from "./modern/ModernBattleCompletionPanel";
import { ModernBattleActionMenu } from "./modern/ModernBattleActionMenu";
import { ModernBattleBagPanel } from "./modern/ModernBattleBagPanel";
import { ModernBattleCaptureLayer } from "./modern/ModernBattleCaptureLayer";
import { ModernBattlePartyExperiencePanel } from "./modern/ModernBattlePartyExperiencePanel";
import {
  ModernBattleEvolutionDecisionPanel,
  type EvolutionDecisionPrompt,
} from "./modern/ModernBattleEvolutionDecisionPanel";

import {
  ModernBattleMoveLearningPanel,
  type MoveLearningPrompt,
} from "./modern/ModernBattleMoveLearningPanel";

// presentation
import { ModernBattleMessagePanel } from "./modern/ModernBattleMessagePanel";

// items assets
import { getPokemonItemSpriteAsset } from "../../pokemon/pokemon-item-sprite.registry";

import type { BattleClientInteractionState } from "../battle-client.types";
import {
  formatPokemonBattleRuleRejectionMessage,
} from "../rules/battle-rules-ui";

import { ModernBattleEvolutionLayer } from "./modern/ModernBattleEvolutionLayer";

import {
  PokemonEvolutionAnimator,
  type PokemonEvolutionAnimationInput,
} from "../evolution/PokemonEvolutionAnimator";
import { BattleMoveVfxController } from "../vfx/BattleMoveVfxController";

const CAPTURE_TARGET_HEAD_OFFSET_PX = 44;
const BATTLE_TOUCH_QUERY = "(hover: none) and (pointer: coarse)";

type BattleCommandLayoutMode = "action" | "moves" | "dense";

const DESKTOP_COMMAND_AREA_RATIO = 0.28;
const DESKTOP_COMMAND_AREA_MIN = 110;

/*
 * Touch landscape should not dedicate the same amount of vertical space
 * to every command panel. Action Menu only needs two rows of buttons,
 * while Party / Bag / target selection genuinely need more room.
 */
const TOUCH_ACTION_COMMAND_AREA_RATIO = 0.3;
const TOUCH_ACTION_COMMAND_AREA_MIN = 128;

const TOUCH_MOVE_COMMAND_AREA_RATIO = 0.44;
const TOUCH_MOVE_COMMAND_AREA_MIN = 190;

const TOUCH_DENSE_COMMAND_AREA_RATIO = 0.44;
const TOUCH_DENSE_COMMAND_AREA_MIN = 172;

const MAX_COMMAND_AREA_RATIO = 0.46;

type BattleExperienceGainedPresentationEvent = Extract<
  BattlePresentationEvent,
  { readonly type: "experience-gained" }
>;

export interface BattleCaptureAudioHooks {
  readonly onContained?: () => void;
  readonly onSuccess?: () => void;
  readonly onFailure?: () => void;
}

export class BattleOverlay {
  private readonly scene: Phaser.Scene;
  private readonly modernRoot: BattleDomRoot;

  private readonly stage: ModernBattleStage;
  private readonly effects: ModernBattleEffectsLayer;
  private readonly moveVfxLayer: ModernBattleMoveVfxLayer;
  private readonly moveVfxController: BattleMoveVfxController;
  private readonly pendingIndicator: ModernBattlePendingIndicator;

  private readonly wildHud: ModernBattlePokemonHud;
  private readonly trainerHud: ModernBattlePokemonHud;
  private readonly movePanel: ModernBattleMovePanel;
  private readonly replacementPanel: ModernBattleReplacementPanel;
  private readonly messagePanel: ModernBattleMessagePanel;
  private readonly completionPanel: ModernBattleCompletionPanel;
  private readonly actionMenu: ModernBattleActionMenu;

  private readonly bagPanel: ModernBattleBagPanel;

  private readonly captureLayer: ModernBattleCaptureLayer;

  private readonly moveLearningPanel: ModernBattleMoveLearningPanel;

  private readonly evolutionDecisionPanel: ModernBattleEvolutionDecisionPanel;
  private readonly evolutionLayer: ModernBattleEvolutionLayer;
  private readonly evolutionAnimator: PokemonEvolutionAnimator;

  private readonly partyExperiencePanel: ModernBattlePartyExperiencePanel;

  private commandLayoutMode: BattleCommandLayoutMode = "action";
  private localParticipantId?: string;

  constructor(
    scene: Phaser.Scene,
    onFightSelected: () => void,
    onPokemonSelected: () => void,
    onItemSelected: () => void,
    onBagItemSelected: (itemId: PokemonItemId) => void,
    onMoveSelected: (moveId: number) => void,
    onMoveBack: () => void,
    onPartyPokemonSelected: (pokemonIndex: number) => void,
    onPokemonBack: () => void,
    onItemBack: () => void,
    onRunSelected: () => void,
    onCompletionContinue: () => void
  ) {
    this.scene = scene;

    this.modernRoot = new BattleDomRoot();

    this.stage = new ModernBattleStage(this.modernRoot.element);
    this.effects = new ModernBattleEffectsLayer(this.modernRoot.element);
    this.moveVfxLayer = new ModernBattleMoveVfxLayer(this.modernRoot.element);
    this.moveVfxController = new BattleMoveVfxController(this.moveVfxLayer);
    this.pendingIndicator = new ModernBattlePendingIndicator(this.modernRoot.element);

    this.captureLayer = new ModernBattleCaptureLayer(this.modernRoot.element);

    this.trainerHud = new ModernBattlePokemonHud(this.modernRoot.element, "trainer");
    this.wildHud = new ModernBattlePokemonHud(this.modernRoot.element, "wild");
    this.actionMenu = new ModernBattleActionMenu(this.modernRoot.element, {
      onFightSelected,
      onPokemonSelected,
      onItemSelected,
      onRunSelected,
    });
    this.movePanel = new ModernBattleMovePanel(this.modernRoot.element, {
      onMoveSelected,
      onBack: onMoveBack,
    });
    this.replacementPanel = new ModernBattleReplacementPanel(this.modernRoot.element, {
      onPartyPokemonSelected,
      onBack: onPokemonBack,
    });
    this.messagePanel = new ModernBattleMessagePanel(this.modernRoot.element);
    this.completionPanel = new ModernBattleCompletionPanel(this.modernRoot.element, {
      onContinue: onCompletionContinue,
    });
    this.bagPanel = new ModernBattleBagPanel(this.modernRoot.element, {
      onItemSelected: onBagItemSelected,
      onBack: onItemBack,
    });
    this.moveLearningPanel = new ModernBattleMoveLearningPanel(this.modernRoot.element);
    this.evolutionDecisionPanel = new ModernBattleEvolutionDecisionPanel(
      this.modernRoot.element
    );
    this.evolutionLayer = new ModernBattleEvolutionLayer(this.modernRoot.element);

    this.evolutionAnimator = new PokemonEvolutionAnimator({
      layer: this.evolutionLayer,
      presentMessage: (message, durationMs) => this.presentMessage(message, durationMs),
    });
    this.partyExperiencePanel = new ModernBattlePartyExperiencePanel(
      this.modernRoot.element
    );

    this.layout();

    this.scene.scale.on("resize", this.handleResize, this);
  }

  public show(): void {
    this.layout();
    this.modernRoot.show();
  }

  public hide(): void {
    this.modernRoot.hide();

    this.completionPanel.hide();

    this.messagePanel.clear();

    this.captureLayer.clear();
    this.effects.clear();
    this.moveVfxController.clear();
    this.pendingIndicator.clear();

    this.trainerHud.clear();
    this.wildHud.clear();

    this.actionMenu.clear();
    this.movePanel.clear();
    this.replacementPanel.clear();
    this.bagPanel.clear();
    this.moveLearningPanel.clear();
    this.evolutionDecisionPanel.clear();
    this.evolutionLayer.clear();

    this.partyExperiencePanel.clear();
    this.localParticipantId = undefined;
  }

  public renderBattle(battle: BattleInstance, localParticipantId: string): void {
    const trainerParticipant = battle.participants.find(
      (participant) => participant.id === localParticipantId
    );

    const opponentParticipant = battle.participants.find(
      (participant) => participant.id !== localParticipantId
    );

    if (
      !trainerParticipant ||
      trainerParticipant.type !== "trainer" ||
      !opponentParticipant
    ) {
      console.warn("[BattleOverlay] invalid battle perspective", {
        battleId: battle.battleId,
        localParticipantId,
      });

      return;
    }

    this.localParticipantId = localParticipantId;
    this.stage.setBattleContext(battle.type, opponentParticipant.displayName);

    const trainerPokemon =
      trainerParticipant.pokemon[trainerParticipant.activePokemonIndex];
    const wildPokemon =
      opponentParticipant.pokemon[opponentParticipant.activePokemonIndex];

    if (!trainerPokemon || !wildPokemon) {
      console.warn("[BattleOverlay] active Pokémon missing", {
        battleId: battle.battleId,
      });

      return;
    }

    this.trainerHud.setPokemon(trainerPokemon);
    this.wildHud.setPokemon(wildPokemon);
    this.actionMenu.setPokemon(trainerPokemon);

    const runDecision = evaluatePokemonBattleRunRule(battle);
    this.actionMenu.setRunAvailability(
      runDecision.allowed,
      runDecision.allowed
        ? undefined
        : formatPokemonBattleRuleRejectionMessage(runDecision.reason),
    );

    this.movePanel.setPokemon(trainerPokemon);
    this.partyExperiencePanel.renderParty(trainerParticipant.pokemon);
  }

  public playBattleIntro(
    battle: BattleInstance,
    localParticipantId: string,
  ): Promise<void> {
    const opponentParticipant = battle.participants.find(
      (participant) => participant.id !== localParticipantId,
    );

    return this.effects.playBattleIntro(
      battle.type,
      opponentParticipant?.displayName,
    );
  }

  public destroy(): void {
    this.scene.scale.off("resize", this.handleResize, this);

    this.trainerHud.destroy();
    this.wildHud.destroy();

    this.actionMenu.destroy();
    this.movePanel.destroy();
    this.replacementPanel.destroy();
    this.moveLearningPanel.destroy();
    this.evolutionDecisionPanel.destroy();

    this.captureLayer.clear();

    this.bagPanel.destroy();

    this.messagePanel.destroy();

    this.completionPanel.destroy();

    this.partyExperiencePanel.destroy();

    this.evolutionLayer.destroy();

    this.pendingIndicator.destroy();
    this.moveVfxController.clear();
    this.moveVfxLayer.destroy();
    this.effects.destroy();
    this.stage.destroy();

    this.modernRoot.destroy();
  }

  private handleResize(): void {
    this.layout();
  }

  private layout(): void {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;

    const isTouchPrimary = window.matchMedia(BATTLE_TOUCH_QUERY).matches;

    const commandAreaHeight = this.resolveCommandAreaHeight(height, isTouchPrimary);

    const battleFieldHeight = height - commandAreaHeight;

    const viewport = {
      width,
      height,
    };

    const commandBounds = {
      x: width / 2,
      y: battleFieldHeight + commandAreaHeight / 2,
      width,
      height: commandAreaHeight,
    };

    const evolutionBounds = {
      x: width / 2,
      y: battleFieldHeight / 2,
      width,
      height: battleFieldHeight,
    };

    this.actionMenu.setBounds(commandBounds, viewport);
    this.movePanel.setBounds(commandBounds, viewport);
    this.replacementPanel.setBounds(commandBounds, viewport);
    this.messagePanel.setBounds(commandBounds, viewport);
    this.bagPanel.setBounds(commandBounds, viewport);
    this.moveLearningPanel.setBounds(commandBounds, viewport);
    this.evolutionDecisionPanel.setBounds(commandBounds, viewport);
    this.evolutionLayer.setBounds(evolutionBounds, viewport);

    /*
     * Conservamos exactamente la distribución
     * que ya estaba funcionando.
     */
    const pokemonAreaWidth = Math.min(width * 0.44, 420);
    const pokemonAreaHeight = Math.min(battleFieldHeight * 0.52, 280);
    const horizontalPadding = Math.max(24, width * 0.06);

    /*
     * Wild:
     * parte superior derecha.
     */
    const wildBounds = {
      x: width - horizontalPadding - pokemonAreaWidth / 2,
      y: battleFieldHeight * 0.3,
      width: pokemonAreaWidth,
      height: pokemonAreaHeight,
    };

    /*
     * Trainer:
     * parte inferior izquierda.
     */
    const trainerBounds = {
      x: horizontalPadding + pokemonAreaWidth / 2,
      y: battleFieldHeight * 0.7,
      width: pokemonAreaWidth,
      height: pokemonAreaHeight,
    };

    this.wildHud.setBounds(wildBounds, viewport);
    this.trainerHud.setBounds(trainerBounds, viewport);
    this.stage.setLayout({
      viewport,
      battleFieldHeight,
      commandAreaHeight,
      trainerBounds,
      wildBounds,
    });
  }

  private resolveCommandAreaHeight(height: number, isTouchPrimary: boolean): number {
    if (!isTouchPrimary) {
      return Math.min(
        height * MAX_COMMAND_AREA_RATIO,
        Math.max(DESKTOP_COMMAND_AREA_MIN, height * DESKTOP_COMMAND_AREA_RATIO)
      );
    }

    const metrics = (() => {
      switch (this.commandLayoutMode) {
        case "action":
          return {
            ratio: TOUCH_ACTION_COMMAND_AREA_RATIO,
            min: TOUCH_ACTION_COMMAND_AREA_MIN,
          };

        case "moves":
          return {
            ratio: TOUCH_MOVE_COMMAND_AREA_RATIO,
            min: TOUCH_MOVE_COMMAND_AREA_MIN,
          };

        case "dense":
          return {
            ratio: TOUCH_DENSE_COMMAND_AREA_RATIO,
            min: TOUCH_DENSE_COMMAND_AREA_MIN,
          };
      }
    })();

    return Math.min(
      height * MAX_COMMAND_AREA_RATIO,
      Math.max(metrics.min, height * metrics.ratio)
    );
  }

  private updateCommandLayoutMode(state: BattleClientInteractionState): void {
    switch (state) {
      case "action-menu":
        this.commandLayoutMode = "action";
        break;

      case "move-selection":
        this.commandLayoutMode = "moves";
        break;

      case "pokemon-selection":
      case "replacement-required":
      case "item-selection":
      case "item-target-selection":
        this.commandLayoutMode = "dense";
        break;

      case "waiting-for-server":
        /*
         * Keep the previous layout. Waiting intentionally preserves the
         * panel that submitted the server-authoritative command.
         */
        break;

      case "completed":
        break;
    }
  }

  public async animatePokemonEvolution(
    input: PokemonEvolutionAnimationInput
  ): Promise<void> {
    /*
     * IMPORTANT:
     *
     * Do NOT restore the normal Battle HUD here.
     *
     * The animation can already be displaying the evolved
     * species while the normal trainer HUD still contains
     * the pre-Evolution Battle snapshot.
     *
     * BattleController owns the authoritative TrainerState,
     * so it must synchronize that state before cinematic
     * mode is released.
     */
    this.setEvolutionCinematicMode(true);

    await this.evolutionAnimator.play(input);
  }

  public syncTrainerPokemonAfterEvolution(
    evolvedPokemon: BattlePokemonState,
    trainerParty: readonly BattlePokemonState[]
  ): void {
    /*
     * Party EXP presentation may contain the evolved Pokémon
     * even when that Pokémon is not currently active.
     */
    this.partyExperiencePanel.renderParty(trainerParty);

    /* A benched Pokémon can also gain EXP and evolve */
    if (!this.trainerHud.isDisplayingPokemon(evolvedPokemon.pokemon.instanceId)) {
      return;
    }

    /* We are still inside cinematic mode here */
    this.trainerHud.setPokemon(evolvedPokemon);
    this.actionMenu.setPokemon(evolvedPokemon);
    this.movePanel.setPokemon(evolvedPokemon);
  }

  public finishPokemonEvolutionCinematic(): void {
    this.setEvolutionCinematicMode(false);
  }

  public setInteractionState(state: BattleClientInteractionState): void {
    this.updateCommandLayoutMode(state);
    this.layout();
    this.pendingIndicator.setVisible(state === "waiting-for-server");

    if (state !== "waiting-for-server") {
      this.messagePanel.clear();
    }

    this.movePanel.setInteractionState(state);
    this.replacementPanel.setInteractionState(state);

    switch (state) {
      case "action-menu":
        this.actionMenu.setEnabled(true);
        this.actionMenu.setVisible(true);

        this.movePanel.setVisible(false);
        this.replacementPanel.setVisible(false);
        this.bagPanel.setVisible(false);
        break;

      case "move-selection":
        this.actionMenu.setVisible(false);

        this.movePanel.setVisible(true);
        this.replacementPanel.setVisible(false);
        this.bagPanel.setVisible(false);
        break;

      case "pokemon-selection":
        this.actionMenu.setVisible(false);

        this.movePanel.setVisible(false);
        this.replacementPanel.setVisible(true);
        this.bagPanel.setVisible(false);
        break;

      case "replacement-required":
        this.actionMenu.setVisible(false);

        this.movePanel.setVisible(false);
        this.replacementPanel.setVisible(true);
        this.bagPanel.setVisible(false);
        break;

      case "completed":
        this.actionMenu.setVisible(false);

        this.movePanel.setVisible(false);
        this.replacementPanel.setVisible(false);
        this.bagPanel.setVisible(false);
        break;

      case "item-selection":
        this.actionMenu.setVisible(false);

        this.movePanel.setVisible(false);
        this.replacementPanel.setVisible(false);

        this.bagPanel.setEnabled(true);
        this.bagPanel.setVisible(true);
        break;

      case "item-target-selection":
        this.actionMenu.setVisible(false);

        this.movePanel.setVisible(false);
        this.bagPanel.setVisible(false);

        this.replacementPanel.setVisible(true);

        break;

      case "waiting-for-server":
        /*
         * Conservamos el panel que ya estaba visible.
         *
         * ActionMenu:
         * disabled.
         *
         * MovePanel / ReplacementPanel:
         * reciben waiting-for-server y se
         * deshabilitan mediante sus reglas internas.
         */
        this.actionMenu.setEnabled(false);
        this.bagPanel.setVisible(false);
        break;
    }
  }

  public setReplacementOptions(
    battle: BattleInstance,
    replacementPokemonIndexes: readonly number[]
  ): void {
    const trainerParticipant = this.getLocalParticipant(battle);

    if (!trainerParticipant) {
      return;
    }

    this.replacementPanel.setMode("forced");
    this.replacementPanel.render(
      battle,
      trainerParticipant.id,
      replacementPokemonIndexes
    );
  }

  public showCompletion(outcome: PokemonBattleCompletedPayload["outcome"]): void {
    this.actionMenu.setVisible(false);
    this.movePanel.setVisible(false);
    this.replacementPanel.setVisible(false);
    this.bagPanel.setVisible(false);
    this.partyExperiencePanel.hide();
    this.completionPanel.show(outcome);
    this.moveLearningPanel.setVisible(false);
    this.evolutionDecisionPanel.setVisible(false);
  }

  public setVoluntaryPokemonOptions(battle: BattleInstance): void {
    const trainerParticipant = this.getLocalParticipant(battle);

    if (!trainerParticipant) {
      return;
    }

    const selectablePokemonIndexes = trainerParticipant.pokemon
      .map((pokemonState, pokemonIndex) => ({
        pokemonState,
        pokemonIndex,
      }))
      .filter(
        ({ pokemonState, pokemonIndex }) =>
          pokemonIndex !== trainerParticipant.activePokemonIndex &&
          pokemonState.currentHp > 0
      )
      .map(({ pokemonIndex }) => pokemonIndex);

    this.replacementPanel.setMode("voluntary");
    this.replacementPanel.render(
      battle,
      trainerParticipant.id,
      selectablePokemonIndexes
    );
  }

  public presentMessage(message: string, durationMs?: number): Promise<void> {
    /* Durante la narración no dejamos ningún menú debajo */
    this.hideCommandPanelsForPresentation();
    return this.messagePanel.present(message, durationMs);
  }

  public async animatePokemonHp(
    battle: BattleInstance,
    participantId: string,
    pokemonInstanceId: string,
    previousHp: number,
    currentHp: number
  ): Promise<void> {
    const participant = battle.participants.find(
      (candidate) => candidate.id === participantId
    );

    if (!participant) {
      return;
    }

    const hud = this.getParticipantHud(battle, participant.id);

    if (!hud) {
      return;
    }

    /* Limpiamos cualquier mensaje antes de empezar la parte puramente visual del evento */
    this.messagePanel.clear();

    this.hideCommandPanelsForPresentation();

    /* Pokémon actualmente en el battlefield */
    if (hud.isDisplayingPokemon(pokemonInstanceId)) {
      /* HP aumentando: Potion / Revive / future healing effects. */
      if (currentHp > previousHp) {
        const isRevive = previousHp === 0 && currentHp > 0;
        await Promise.all([
          hud.animateHp(pokemonInstanceId, previousHp, currentHp, 720),
          hud.animateHpRestoreEffect(pokemonInstanceId, isRevive, 760),
        ]);
        return;
      }

      /* Damage conserva la animación normal */
      await hud.animateHp(pokemonInstanceId, previousHp, currentHp);
      return;
    }

    if (participant.id === this.localParticipantId) {
      this.replacementPanel.setVisible(true);

      try {
        await this.replacementPanel.animatePokemonHp(
          pokemonInstanceId,
          previousHp,
          currentHp
        );
      } finally {
        this.replacementPanel.setVisible(false);
      }
    }
  }

  public playMoveVfx(
    battle: BattleInstance,
    participantId: string,
    pokemonInstanceId: string,
    moveId: number,
    missed = false,
  ): Promise<void> {
    const sourceParticipant = battle.participants.find(
      (candidate) => candidate.id === participantId,
    );

    const targetParticipant = battle.participants.find(
      (candidate) => candidate.id !== participantId,
    );

    if (!sourceParticipant || !targetParticipant) {
      return Promise.resolve();
    }

    const sourceHud = this.getParticipantHud(battle, sourceParticipant.id);
    const targetHud = this.getParticipantHud(battle, targetParticipant.id);

    if (!sourceHud || !targetHud) {
      return Promise.resolve();
    }

    if (!sourceHud.isDisplayingPokemon(pokemonInstanceId)) {
      return Promise.resolve();
    }

    const targetPokemon = targetParticipant.pokemon[targetParticipant.activePokemonIndex];

    if (!targetPokemon || !targetHud.isDisplayingPokemon(targetPokemon.pokemon.instanceId)) {
      return Promise.resolve();
    }

    const container = this.modernRoot.element;
    const source = sourceHud.getMoveVfxSourcePoint(container);
    const target = targetHud.getMoveVfxTargetPoint(container);

    if (!source || !target) {
      return Promise.resolve();
    }

    return this.moveVfxController.play({
      moveId,
      source,
      target,
      missed,
      actorMotion: {
        playContactMotion: (motionRequest) =>
          sourceHud.animateMoveVfxContactMotion(container, motionRequest),
      },
    });
  }

  public animatePokemonHit(
    battle: BattleInstance,
    participantId: string,
    pokemonInstanceId: string
  ): Promise<void> {
    const hud = this.getParticipantHud(battle, participantId);

    if (!hud) {
      return Promise.resolve();
    }

    if (!hud.isDisplayingPokemon(pokemonInstanceId)) {
      return Promise.resolve();
    }

    const impactSide = participantId === this.localParticipantId
      ? "local"
      : "opponent";

    return Promise.all([
      hud.animateHit(pokemonInstanceId),
      this.effects.playImpact(impactSide),
    ]).then(() => undefined);
  }

  public animatePokemonSwitchOut(
    battle: BattleInstance,
    participantId: string,
    pokemonInstanceId: string
  ): Promise<void> {
    const hud = this.getParticipantHud(battle, participantId);

    if (!hud) {
      return Promise.resolve();
    }

    return hud.animateSwitchOut(pokemonInstanceId);
  }

  public animatePokemonSwitchIn(
    battle: BattleInstance,
    participantId: string,
    pokemonInstanceId: string
  ): Promise<void> {
    const participant = battle.participants.find(
      (candidate) => candidate.id === participantId
    );

    if (!participant) {
      return Promise.resolve();
    }

    const pokemonState = participant.pokemon.find(
      (candidate) => candidate.pokemon.instanceId === pokemonInstanceId
    );

    if (!pokemonState) {
      console.warn("[BattleOverlay] switch-in Pokémon not found", {
        battleId: battle.battleId,
        participantId,
        pokemonInstanceId,
      });
      return Promise.resolve();
    }

    const hud = this.getParticipantHud(battle, participant.id);

    if (!hud) {
      return Promise.resolve();
    }

    return hud.animateSwitchIn(pokemonState);
  }

  public animatePokemonFaint(
    battle: BattleInstance,
    participantId: string,
    pokemonInstanceId: string
  ): Promise<void> {
    const hud = this.getParticipantHud(battle, participantId);

    if (!hud) {
      return Promise.resolve();
    }

    return hud.animateFaint(pokemonInstanceId);
  }

  private getParticipantHud(
    battle: BattleInstance,
    participantId: string
  ): ModernBattlePokemonHud | undefined {
    const participant = battle.participants.find(
      (candidate) => candidate.id === participantId
    );

    if (!participant) {
      console.warn("[BattleOverlay] participant HUD not found", {
        battleId: battle.battleId,
        participantId,
      });
      return undefined;
    }

    if (!this.localParticipantId) {
      return undefined;
    }

    return participant.id === this.localParticipantId
      ? this.trainerHud
      : this.wildHud;
  }

  private getLocalParticipant(battle: BattleInstance) {
    if (!this.localParticipantId) {
      return undefined;
    }

    const participant = battle.participants.find(
      (candidate) => candidate.id === this.localParticipantId
    );

    return participant?.type === "trainer" ? participant : undefined;
  }

  public setBagInventory(
    battle: BattleInstance,
    inventory: PokemonInventory,
  ): void {
    this.bagPanel.render(battle, inventory);
  }

  public setItemTargetOptions(
    battle: BattleInstance,
    selectablePokemonIndexes: readonly number[]
  ): void {
    const trainerParticipant = this.getLocalParticipant(battle);

    if (!trainerParticipant) {
      return;
    }

    this.replacementPanel.setMode("item-target");
    this.replacementPanel.render(
      battle,
      trainerParticipant.id,
      selectablePokemonIndexes
    );
  }

  public async animatePokemonCapture(
    battle: BattleInstance,
    itemId: PokemonItemId,
    wildParticipantId: string,
    pokemonInstanceId: string,
    shakeCount: number,
    captured: boolean,
    audioHooks?: BattleCaptureAudioHooks
  ): Promise<void> {
    const participant = battle.participants.find(
      (candidate) => candidate.id === wildParticipantId
    );

    if (!participant || participant.type !== "wild") {
      console.warn("[BattleOverlay] invalid Wild participant for Capture", {
        battleId: battle.battleId,
        wildParticipantId,
      });
      return;
    }

    if (!this.wildHud.isDisplayingPokemon(pokemonInstanceId)) {
      return;
    }

    /* Capture presentation usa específicamente el asset 64×64 */
    const itemAsset = getPokemonItemSpriteAsset(itemId, 64);

    if (!itemAsset) {
      console.warn("[BattleOverlay] Capture item asset not found", {
        battleId: battle.battleId,
        itemId,
      });
      /* Un asset faltante NO puede alterar el resultado del gameplay */
      return;
    }

    const overlayElement = this.modernRoot.element;

    const throwStart = this.trainerHud.getCaptureThrowOrigin(overlayElement);

    const rawTargetPoint = this.wildHud.getCaptureTargetPoint(overlayElement);

    const targetPoint = rawTargetPoint
      ? {
          x: rawTargetPoint.x,
          y: rawTargetPoint.y - CAPTURE_TARGET_HEAD_OFFSET_PX,
        }
      : null;

    const groundPoint = this.wildHud.getCaptureGroundPoint(overlayElement);

    if (!throwStart || !targetPoint || !groundPoint) {
      console.warn("[BattleOverlay] missing capture anchors", {
        battleId: battle.battleId,
        itemId,
        wildParticipantId,
        pokemonInstanceId,
      });
      return;
    }

    this.captureLayer.setAnchors({
      throwStart,
      targetPoint,
      groundPoint,
    });

    await this.captureLayer.playCapture({
      itemAssetPath: itemAsset.path,
      shakeCount,
      captured,
      onAbsorb: () => this.wildHud.animateCaptureAbsorb(pokemonInstanceId),
      onBreakFree: captured
        ? undefined
        : () => this.wildHud.animateCaptureBreakFree(pokemonInstanceId),
      onContained: audioHooks?.onContained,
      onSuccess: audioHooks?.onSuccess,
      onFailure: audioHooks?.onFailure,
    });
  }

  private hideCommandPanelsForPresentation(): void {
    this.actionMenu.setVisible(false);
    this.movePanel.setVisible(false);
    this.replacementPanel.setVisible(false);
    this.bagPanel.setVisible(false);
    this.moveLearningPanel.setVisible(false);
  }

  public requestMoveLearningDecision(
    prompt: MoveLearningPrompt
  ): Promise<PokemonMoveLearningDecision> {
    this.messagePanel.clear();

    this.actionMenu.setVisible(false);
    this.movePanel.setVisible(false);
    this.replacementPanel.setVisible(false);
    this.bagPanel.setVisible(false);

    return this.moveLearningPanel.prompt(prompt);
  }

  public setMoveLearningWaiting(waiting: boolean): void {
    this.moveLearningPanel.setWaiting(waiting);
  }

  public hideMoveLearning(): void {
    this.moveLearningPanel.setVisible(false);
  }

  public requestEvolutionDecision(
    prompt: EvolutionDecisionPrompt
  ): Promise<PokemonEvolutionDecision> {
    this.messagePanel.clear();

    this.actionMenu.setVisible(false);
    this.movePanel.setVisible(false);
    this.replacementPanel.setVisible(false);
    this.bagPanel.setVisible(false);

    /* Evolution cannot overlap the Move Learning UI */
    this.moveLearningPanel.setVisible(false);

    return this.evolutionDecisionPanel.prompt(prompt);
  }

  public setEvolutionDecisionWaiting(waiting: boolean): void {
    this.evolutionDecisionPanel.setWaiting(waiting);
  }

  public hideEvolutionDecision(): void {
    this.evolutionDecisionPanel.setVisible(false);
  }

  public animatePartyExperienceGainBatch(
    battle: BattleInstance,
    events: readonly BattleExperienceGainedPresentationEvent[]
  ): Promise<void> {
    if (events.length === 0) {
      return Promise.resolve();
    }

    this.hideCommandPanelsForPresentation();

    /* Critical difference from the old flow: map() invokes every animation immediately */
    return Promise.all(
      events.map((event) =>
        this.animatePokemonExperienceGain(
          battle,
          event.participantId,
          event.pokemonInstanceId,
          event.gainedExperience,
          event.previousExperience,
          event.currentExperience,
          event.previousLevel,
          event.currentLevel
        )
      )
    ).then(() => undefined);
  }

  public animatePokemonExperienceGain(
    battle: BattleInstance,
    participantId: string,
    pokemonInstanceId: string,
    gainedExperience: number,
    previousExperience: number,
    currentExperience: number,
    previousLevel: number,
    currentLevel: number
  ): Promise<void> {
    const participant = battle.participants.find(
      (candidate) => candidate.id === participantId
    );

    if (
      !participant ||
      participant.type !== "trainer" ||
      participant.id !== this.localParticipantId
    ) {
      return Promise.resolve();
    }

    this.hideCommandPanelsForPresentation();

    const animations: Promise<void>[] = [
      this.partyExperiencePanel.animateExperienceGain(
        pokemonInstanceId,
        gainedExperience,
        previousExperience,
        currentExperience,
        previousLevel,
        currentLevel
      ),
    ];

    /* El Pokémon activo conserva además su HUD grande de EXP */
    if (this.trainerHud.isDisplayingPokemon(pokemonInstanceId)) {
      animations.push(
        this.trainerHud.animateExperienceGain(
          pokemonInstanceId,
          gainedExperience,
          previousExperience,
          currentExperience,
          previousLevel,
          currentLevel
        )
      );
    }

    return Promise.all(animations).then(() => undefined);
  }

  public animatePokemonLevelUp(
    battle: BattleInstance,
    participantId: string,
    pokemonInstanceId: string,
    currentLevel: number
  ): Promise<void> {
    const participant = battle.participants.find(
      (candidate) => candidate.id === participantId
    );

    if (
      !participant ||
      participant.type !== "trainer" ||
      participant.id !== this.localParticipantId
    ) {
      return Promise.resolve();
    }

    this.hideCommandPanelsForPresentation();

    const animations: Promise<void>[] = [
      this.partyExperiencePanel.animateLevelUp(pokemonInstanceId, currentLevel),
    ];

    if (this.trainerHud.isDisplayingPokemon(pokemonInstanceId)) {
      animations.push(this.trainerHud.animateLevelUp(pokemonInstanceId, currentLevel));
    }

    return Promise.all(animations).then(() => undefined);
  }

  private setEvolutionCinematicMode(active: boolean): void {
    this.trainerHud.setCinematicHidden(active);
    this.wildHud.setCinematicHidden(active);
    this.partyExperiencePanel.setCinematicHidden(active);

    if (!active) {
      return;
    }

    this.hideCommandPanelsForPresentation();
    this.moveLearningPanel.setVisible(false);
    this.evolutionDecisionPanel.setVisible(false);
  }
}
