import Phaser from "phaser";

import {
  POKEMON_ITEM_REGISTRY,
  type PokemonInstance,
  type PokemonInventory,
  type PokemonOverworldItemErrorCode,
  type PokemonOverworldItemErrorPayload,
  type PokemonOverworldItemUseInput,
  type PokemonOverworldItemUsedPayload,
} from "@cesar-mmo/shared";

import { PartyPanel } from "./PartyPanel";
import { InventoryPanel } from "./InventoryPanel";

export interface TrainerPanelControllerOptions {
  readonly isInteractionBlocked: () => boolean;
  readonly onUseOverworldItem: (input: PokemonOverworldItemUseInput) => void;
}

export class TrainerPanelController {
  private readonly scene: Phaser.Scene;

  private readonly partyPanel: PartyPanel;
  private readonly inventoryPanel: InventoryPanel;

  private readonly partyKey: Phaser.Input.Keyboard.Key;
  private readonly inventoryKey: Phaser.Input.Keyboard.Key;
  private readonly escapeKey: Phaser.Input.Keyboard.Key;

  private readonly isInteractionBlocked: () => boolean;
  private readonly onUseOverworldItem: (
    input: PokemonOverworldItemUseInput,
  ) => void;

  private selectedOverworldItemId?: PokemonOverworldItemUseInput["itemId"];
  private isOverworldItemUsePending = false;

  private readonly feedbackText: Phaser.GameObjects.Text;
  private feedbackTimer?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene, options: TrainerPanelControllerOptions) {
    this.scene = scene;
    this.isInteractionBlocked = options.isInteractionBlocked;
    this.onUseOverworldItem = options.onUseOverworldItem;
    const keyboard = this.scene.input.keyboard;

    if (!keyboard) {
      throw new Error(
        "Keyboard input is not available for TrainerPanelController",
      );
    }

    this.partyKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P, false);
    this.inventoryKey = keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.I,
      false,
    );
    this.escapeKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC, false);

    this.partyPanel = new PartyPanel(this.scene, {
      onPokemonSelected: (pokemon) => {
        this.handleOverworldItemTargetSelected(pokemon);
      },
    });
    this.inventoryPanel = new InventoryPanel(this.scene, {
      onItemSelected: (itemId) => {
        this.handleOverworldItemSelected(itemId);
      },
    });

    this.feedbackText = this.scene.add
      .text(this.scene.scale.width / 2, 18, "", {
        fontFamily: "Arial",
        fontSize: "11px",
        color: "#ffffff",
        backgroundColor: "rgba(17, 24, 39, 0.96)",
        padding: {
          x: 10,
          y: 6,
        },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(2200)
      .setVisible(false);
  }

  public update(): void {
    this.handleClose();
    this.handlePartyToggle();
    this.handleInventoryToggle();
  }

  public setParty(party: readonly PokemonInstance[]): void {
    this.partyPanel.setParty(party);
  }

  public setInventory(inventory: PokemonInventory): void {
    this.inventoryPanel.setInventory(inventory);
  }

  public get isOpen(): boolean {
    return this.partyPanel.isVisible() || this.inventoryPanel.isVisible();
  }

  /*
   * Se mantiene separado por ahora porque
   * GameScene actualmente bloquea algunos
   * world systems específicamente con Party.
   *
   * Esto preserva comportamiento durante
   * el refactor.
   */
  public get isPartyVisible(): boolean {
    return this.partyPanel.isVisible();
  }

  public close(): void {
    this.selectedOverworldItemId = undefined;
    this.partyPanel.setTargetSelectionMode(false);
    this.partyPanel.hide();
    this.inventoryPanel.hide();
  }

  public handleOverworldItemUsed(
    payload: PokemonOverworldItemUsedPayload,
  ): void {
    this.isOverworldItemUsePending = false;
    const item = POKEMON_ITEM_REGISTRY[payload.itemId];
    this.showFeedback(`${item.name} usada correctamente.`);
  }

  public handleOverworldItemError(
    payload: PokemonOverworldItemErrorPayload,
  ): void {
    this.isOverworldItemUsePending = false;
    this.showFeedback(this.getOverworldItemErrorMessage(payload.code));
  }

  private handleInventoryToggle(): void {
    if (this.selectedOverworldItemId || this.isOverworldItemUsePending) {
      return;
    }

    if (this.isInteractionBlocked()) {
      return;
    }

    if (!Phaser.Input.Keyboard.JustDown(this.inventoryKey)) {
      return;
    }

    const willOpen = !this.inventoryPanel.isVisible();

    if (willOpen) {
      this.partyPanel.hide();
    }

    this.inventoryPanel.toggle();
  }

  private handlePartyToggle(): void {
    if (this.selectedOverworldItemId || this.isOverworldItemUsePending) {
      return;
    }

    if (this.isInteractionBlocked()) {
      return;
    }

    if (!Phaser.Input.Keyboard.JustDown(this.partyKey)) {
      return;
    }

    const willOpen = !this.partyPanel.isVisible();

    if (willOpen) {
      this.inventoryPanel.hide();
    }

    /* PartyPanel ya sabe si existe al menos un Pokémon */
    this.partyPanel.toggle();
  }

  private handleClose(): void {
    if (!Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
      return;
    }

    if (this.selectedOverworldItemId) {
      this.cancelOverworldItemTargetSelection();
      return;
    }

    if (!this.isOpen) {
      return;
    }

    this.close();
  }

  private handleOverworldItemSelected(
    itemId: PokemonOverworldItemUseInput["itemId"],
  ): void {
    this.selectedOverworldItemId = itemId;
    this.inventoryPanel.hide();
    this.partyPanel.setTargetSelectionMode(true);
    this.partyPanel.show();
  }

  private handleOverworldItemTargetSelected(pokemon: PokemonInstance): void {
    if (this.isOverworldItemUsePending) {
      return;
    }

    const itemId = this.selectedOverworldItemId;

    if (!itemId) {
      return;
    }

    this.isOverworldItemUsePending = true;

    /* Controller decide la intención UI. Sólo manda itemId + target */
    this.onUseOverworldItem({
      itemId,
      targetPokemonInstanceId: pokemon.instanceId,
    });
    this.selectedOverworldItemId = undefined;
    this.partyPanel.setTargetSelectionMode(false);
    this.partyPanel.hide();
  }

  private cancelOverworldItemTargetSelection(): void {
    this.selectedOverworldItemId = undefined;
    this.partyPanel.setTargetSelectionMode(false);
    this.partyPanel.hide();
    this.inventoryPanel.show();
  }

  private showFeedback(message: string): void {
    this.feedbackTimer?.remove(false);
    this.feedbackText.setText(message).setVisible(true);
    this.feedbackTimer = this.scene.time.delayedCall(2200, () => {
      this.feedbackText.setVisible(false);
      this.feedbackTimer = undefined;
    });
  }

  private getOverworldItemErrorMessage(
    code: PokemonOverworldItemErrorCode,
  ): string {
    switch (code) {
      case "ITEM_NOT_AVAILABLE":
        return "Ya no tienes ese objeto.";

      case "ITEM_NOT_USABLE":
        return "Ese objeto no puede usarse aquí.";

      case "INVALID_TARGET":
        return "Ese Pokémon no es un objetivo válido.";

      case "TARGET_FAINTED":
        return "No puedes usar ese objeto sobre un Pokémon debilitado.";

      case "TARGET_FULL_HP":
        return "Ese Pokémon ya tiene todos sus PS.";

      case "INCOMPATIBLE_STATE":
        return "No puedes usar objetos en este momento.";

      case "INVALID_INPUT":
        return "No se pudo usar ese objeto.";

      case "PERSISTENCE_FAILED":
        return "No se pudo guardar el uso del objeto.";
    }
  }
}
