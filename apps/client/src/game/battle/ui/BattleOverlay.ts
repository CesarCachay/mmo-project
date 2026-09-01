import Phaser from "phaser";

import type { BattleInstance, PokemonBattleCompletedPayload } from "@cesar-mmo/shared";

import { BattleDomRoot } from "./modern/BattleDomRoot";
import { ModernBattleStage } from "./modern/ModernBattleStage";

import { ModernBattlePokemonHud } from "./modern/ModernBattlePokemonHud";
import { ModernBattleMovePanel } from "./modern/ModernBattleMovePanel";
import { ModernBattleReplacementPanel } from "./modern/ModernBattleReplacementPanel";
import { ModernBattleCompletionPanel } from "./modern/ModernBattleCompletionPanel";

import type { BattleClientInteractionState } from "../battle-client.types";

export class BattleOverlay {
  private readonly scene: Phaser.Scene;
  private readonly modernRoot: BattleDomRoot;

  private readonly stage: ModernBattleStage;

  private readonly wildHud: ModernBattlePokemonHud;
  private readonly trainerHud: ModernBattlePokemonHud;
  private readonly movePanel: ModernBattleMovePanel;
  private readonly replacementPanel: ModernBattleReplacementPanel;
  private readonly completionPanel: ModernBattleCompletionPanel;

  constructor(
    scene: Phaser.Scene,
    onMoveSelected: (moveId: number) => void,
    onReplacementSelected: (pokemonIndex: number) => void,
    onCompletionContinue: () => void
  ) {
    this.scene = scene;

    this.modernRoot = new BattleDomRoot();

    this.stage = new ModernBattleStage(this.modernRoot.element);

    this.trainerHud = new ModernBattlePokemonHud(this.modernRoot.element, "trainer");
    this.wildHud = new ModernBattlePokemonHud(this.modernRoot.element, "wild");
    this.movePanel = new ModernBattleMovePanel(this.modernRoot.element, {
      onMoveSelected,
    });
    this.replacementPanel = new ModernBattleReplacementPanel(this.modernRoot.element, {
      onReplacementSelected,
    });
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

    this.trainerHud.clear();
    this.wildHud.clear();

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
    this.movePanel.setPokemon(trainerPokemon);
  }

  public destroy(): void {
    this.scene.scale.off("resize", this.handleResize, this);

    this.trainerHud.destroy();
    this.wildHud.destroy();

    this.movePanel.destroy();
    this.replacementPanel.destroy();

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

    this.movePanel.setBounds(commandBounds, viewport);
    this.replacementPanel.setBounds(commandBounds, viewport);

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
    this.movePanel.setInteractionState(state);
    this.replacementPanel.setInteractionState(state);

    switch (state) {
      case "selecting-action":
        this.movePanel.setVisible(true);
        this.replacementPanel.setVisible(false);
        break;

      case "replacement-required":
        this.movePanel.setVisible(false);
        this.replacementPanel.setVisible(true);
        break;

      case "completed":
        this.movePanel.setVisible(false);
        this.replacementPanel.setVisible(false);
        break;

      case "waiting-for-server":
        /*
         * IMPORTANTE:
         * No cambiamos qué panel es visible.
         * Si veníamos de Move Selection,
         * sigue visible pero disabled.
         * Si veníamos de Replacement,
         * sigue visible pero disabled.
         */
        break;
    }
  }

  public setReplacementOptions(
    battle: BattleInstance,
    replacementPokemonIndexes: readonly number[]
  ): void {
    this.replacementPanel.render(battle, replacementPokemonIndexes);
  }

  public showCompletion(outcome: PokemonBattleCompletedPayload["outcome"]): void {
    this.movePanel.setVisible(false);
    this.replacementPanel.setVisible(false);
    this.completionPanel.show(outcome);
  }
}
