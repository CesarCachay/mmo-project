import Phaser from "phaser";

import type { BattleInstance, PokemonBattleCompletedPayload } from "@cesar-mmo/shared";

import { BattleDomRoot } from "./modern/BattleDomRoot";
import { ModernBattleStage } from "./modern/ModernBattleStage";

import { ModernBattlePokemonHud } from "./modern/ModernBattlePokemonHud";
import { ModernBattleMovePanel } from "./modern/ModernBattleMovePanel";
import { ModernBattleReplacementPanel } from "./modern/ModernBattleReplacementPanel";
import { ModernBattleCompletionPanel } from "./modern/ModernBattleCompletionPanel";
import { ModernBattleActionMenu } from "./modern/ModernBattleActionMenu";

// presentation
import { ModernBattleMessagePanel } from "./modern/ModernBattleMessagePanel";

import type { BattleClientInteractionState } from "../battle-client.types";

export class BattleOverlay {
  private readonly scene: Phaser.Scene;
  private readonly modernRoot: BattleDomRoot;

  private readonly stage: ModernBattleStage;

  private readonly wildHud: ModernBattlePokemonHud;
  private readonly trainerHud: ModernBattlePokemonHud;
  private readonly movePanel: ModernBattleMovePanel;
  private readonly replacementPanel: ModernBattleReplacementPanel;
  private readonly messagePanel: ModernBattleMessagePanel;
  private readonly completionPanel: ModernBattleCompletionPanel;
  private readonly actionMenu: ModernBattleActionMenu;

  constructor(
    scene: Phaser.Scene,
    onFightSelected: () => void,
    onPokemonSelected: () => void,
    onRunSelected: () => void,
    onMoveSelected: (moveId: number) => void,
    onMoveBack: () => void,
    onPartyPokemonSelected: (pokemonIndex: number) => void,
    onPokemonBack: () => void,
    onCompletionContinue: () => void
  ) {
    this.scene = scene;

    this.modernRoot = new BattleDomRoot();

    this.stage = new ModernBattleStage(this.modernRoot.element);

    this.trainerHud = new ModernBattlePokemonHud(this.modernRoot.element, "trainer");
    this.wildHud = new ModernBattlePokemonHud(this.modernRoot.element, "wild");
    this.actionMenu = new ModernBattleActionMenu(this.modernRoot.element, {
      onFightSelected,
      onPokemonSelected,
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

    this.trainerHud.clear();
    this.wildHud.clear();

    this.actionMenu.clear();
    this.movePanel.clear();
    this.replacementPanel.clear();
  }

  public renderBattle(battle: BattleInstance): void {
    const trainerParticipant = battle.participants.find(
      (participant) => participant.type === "trainer"
    );

    const wildParticipant = battle.participants.find(
      (participant) => participant.type === "wild"
    );

    if (!trainerParticipant || !wildParticipant) {
      console.warn("[BattleOverlay] invalid Wild Battle participants", {
        battleId: battle.battleId,
      });

      return;
    }

    const trainerPokemon =
      trainerParticipant.pokemon[trainerParticipant.activePokemonIndex];
    const wildPokemon = wildParticipant.pokemon[wildParticipant.activePokemonIndex];

    if (!trainerPokemon || !wildPokemon) {
      console.warn("[BattleOverlay] active Pokémon missing", {
        battleId: battle.battleId,
      });

      return;
    }

    this.trainerHud.setPokemon(trainerPokemon);
    this.wildHud.setPokemon(wildPokemon);
    this.actionMenu.setPokemon(trainerPokemon);
    this.movePanel.setPokemon(trainerPokemon);
  }

  public destroy(): void {
    this.scene.scale.off("resize", this.handleResize, this);

    this.trainerHud.destroy();
    this.wildHud.destroy();

    this.actionMenu.destroy();
    this.movePanel.destroy();
    this.replacementPanel.destroy();

    this.messagePanel.destroy();

    this.completionPanel.destroy();

    this.stage.destroy();

    this.modernRoot.destroy();
  }

  private handleResize(): void {
    this.layout();
  }

  private layout(): void {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;

    const commandAreaHeight = Math.max(110, height * 0.28);
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

    this.actionMenu.setBounds(commandBounds, viewport);
    this.movePanel.setBounds(commandBounds, viewport);
    this.replacementPanel.setBounds(commandBounds, viewport);
    this.messagePanel.setBounds(commandBounds, viewport);

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

  public setInteractionState(state: BattleClientInteractionState): void {
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
        break;

      case "move-selection":
        this.actionMenu.setVisible(false);

        this.movePanel.setVisible(true);
        this.replacementPanel.setVisible(false);
        break;

      case "pokemon-selection":
        this.actionMenu.setVisible(false);

        this.movePanel.setVisible(false);
        this.replacementPanel.setVisible(true);
        break;

      case "replacement-required":
        this.actionMenu.setVisible(false);

        this.movePanel.setVisible(false);
        this.replacementPanel.setVisible(true);
        break;

      case "completed":
        this.actionMenu.setVisible(false);

        this.movePanel.setVisible(false);
        this.replacementPanel.setVisible(false);
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
        break;
    }
  }

  public setReplacementOptions(
    battle: BattleInstance,
    replacementPokemonIndexes: readonly number[]
  ): void {
    this.replacementPanel.setMode("forced");
    this.replacementPanel.render(battle, replacementPokemonIndexes);
  }

  public showCompletion(outcome: PokemonBattleCompletedPayload["outcome"]): void {
    this.actionMenu.setVisible(false);
    this.movePanel.setVisible(false);
    this.replacementPanel.setVisible(false);
    this.completionPanel.show(outcome);
  }

  public setVoluntaryPokemonOptions(battle: BattleInstance): void {
    const trainerParticipant = battle.participants.find(
      (participant) => participant.type === "trainer"
    );

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
    this.replacementPanel.render(battle, selectablePokemonIndexes);
  }

  public presentMessage(message: string, durationMs?: number): Promise<void> {
    return this.messagePanel.present(message, durationMs);
  }

  public animatePokemonHp(
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
      return Promise.resolve();
    }

    const hud = participant.type === "trainer" ? this.trainerHud : this.wildHud;

    if (!hud.isDisplayingPokemon(pokemonInstanceId)) {
      return Promise.resolve();
    }

    return hud.animateHp(pokemonInstanceId, previousHp, currentHp);
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

    return hud.animateHit(pokemonInstanceId);
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

    const hud = participant.type === "trainer" ? this.trainerHud : this.wildHud;

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

    return participant.type === "trainer" ? this.trainerHud : this.wildHud;
  }
}
