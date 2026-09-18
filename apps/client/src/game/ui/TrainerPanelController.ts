import Phaser from "phaser";

import {
  POKEMON_ITEM_REGISTRY,
  type PokemonInstance,
  type PokemonInventory,
  type PokemonOverworldItemErrorCode,
  type PokemonOverworldItemErrorPayload,
  type PokemonOverworldItemUseInput,
  type PokemonOverworldItemUsedPayload,
  type PokemonPartyReorderInput,
  type PokemonPartyReorderedPayload,
  type PokemonPartyReorderErrorPayload,
} from "@cesar-mmo/shared";

import { PartyDrawer } from "./PartyDrawer";
import { InventoryDrawer } from "./InventoryDrawer";
import { TrainerDrawer } from "./TrainerDrawer";

export interface TrainerPanelControllerOptions {
  readonly isInteractionBlocked: () => boolean;
  readonly onUseOverworldItem: (input: PokemonOverworldItemUseInput) => void;
  readonly onReorderParty: (input: PokemonPartyReorderInput) => void;
}

export type TrainerPanelSurface =
  | "party"
  | "inventory"
  | "trainer";

interface PendingOverworldItemPresentation {
  readonly itemId: PokemonOverworldItemUseInput["itemId"];
  readonly targetPokemonInstanceId: string;
  readonly previousHp: number;
}

export class TrainerPanelController {
  private readonly scene: Phaser.Scene;

  private readonly partyDrawer: PartyDrawer;
  private readonly inventoryDrawer: InventoryDrawer;
  private readonly trainerDrawer: TrainerDrawer;

  private readonly partyKey: Phaser.Input.Keyboard.Key;
  private readonly inventoryKey: Phaser.Input.Keyboard.Key;
  private readonly escapeKey: Phaser.Input.Keyboard.Key;

  private readonly isInteractionBlocked: () => boolean;
  private readonly onUseOverworldItem: (
    input: PokemonOverworldItemUseInput,
  ) => void;
  private readonly onReorderParty: (input: PokemonPartyReorderInput) => void;

  private selectedOverworldItemId?: PokemonOverworldItemUseInput["itemId"];
  private isOverworldItemUsePending = false;

  private pendingOverworldItemPresentation?: PendingOverworldItemPresentation;
  private deferredPartyDuringOverworldItem?: readonly PokemonInstance[];

  private partyReorderSourceInstanceId: string | undefined;
  private isPartyReorderPending = false;

  private readonly feedbackText: Phaser.GameObjects.Text;
  private feedbackTimer?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene, options: TrainerPanelControllerOptions) {
    this.scene = scene;
    this.isInteractionBlocked = options.isInteractionBlocked;
    this.onUseOverworldItem = options.onUseOverworldItem;
    this.onReorderParty = options.onReorderParty;
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

    this.partyDrawer = new PartyDrawer({
      onPokemonSelected: (pokemon, index) => {
        this.handlePartyPokemonSelected(pokemon, index);
      },
      onChangeRequested: (pokemon) => {
        this.handlePartyChangeRequested(pokemon);
      },

      onReorderRequested: () => {
        this.handlePartyReorderRequested();
      },

      onCloseRequested: () => {
        this.handlePartyDrawerCloseRequested();
      },
    });
    this.inventoryDrawer = new InventoryDrawer({
      onItemSelected: (itemId) => {
        this.handleOverworldItemSelected(itemId);
      },

      onCloseRequested: () => {
        this.handleInventoryDrawerCloseRequested();
      },
    });

    this.trainerDrawer = new TrainerDrawer({
      onCloseRequested: () => {
        this.trainerDrawer.hide();
      },
    });

    this.scene.events.once(
      Phaser.Scenes.Events.SHUTDOWN,
      () => {
        this.partyDrawer.destroy();
        this.inventoryDrawer.destroy();
        this.trainerDrawer.destroy();
      },
    );

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
    this.trainerDrawer.setPartyCount(party.length);

    /* Si hay un item esperando presentación, conservamos visualmente la Party anterior */
    if (this.pendingOverworldItemPresentation) {
      this.deferredPartyDuringOverworldItem = party;
      return;
    }
    this.partyDrawer.setParty(party);
  }

  public setInventory(inventory: PokemonInventory): void {
    this.inventoryDrawer.setInventory(inventory);
    this.trainerDrawer.setInventory(inventory);
  }

  public get isOpen(): boolean {
    return (
      this.partyDrawer.isVisible() ||
      this.inventoryDrawer.isVisible() ||
      this.trainerDrawer.isVisible()
    );
  }

  public get activePanel(): TrainerPanelSurface | undefined {
    if (this.partyDrawer.isVisible()) {
      return "party";
    }

    if (this.inventoryDrawer.isVisible()) {
      return "inventory";
    }

    if (this.trainerDrawer.isVisible()) {
      return "trainer";
    }

    return undefined;
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
    return this.partyDrawer.isVisible();
  }

  public close(): void {
    this.selectedOverworldItemId = undefined;
    this.isOverworldItemUsePending = false;
    this.pendingOverworldItemPresentation = undefined;
    this.deferredPartyDuringOverworldItem = undefined;
    this.partyReorderSourceInstanceId = undefined;
    this.partyDrawer.setTargetSelectionMode(false);
    this.partyDrawer.setReorderState({
      active: false,
      sourcePokemonInstanceId: undefined,
      pending: false,
    });
    this.partyDrawer.hide();
    this.inventoryDrawer.hide();
    this.trainerDrawer.hide();
  }

  public async handleOverworldItemUsed(
    payload: PokemonOverworldItemUsedPayload,
  ): Promise<void> {
    const item = POKEMON_ITEM_REGISTRY[payload.itemId];
    const pending = this.pendingOverworldItemPresentation;

    const matchesPendingRequest =
      pending?.itemId === payload.itemId &&
      pending.targetPokemonInstanceId === payload.targetPokemonInstanceId;

    if (!matchesPendingRequest) {
      this.finishOverworldItemPresentation();
      this.showFeedback(`Used a ${item.name}!`);
      return;
    }

    /* Shared registry se usa sólo para presentation. La regla real ya fue validada por server */
    const isRevive = item.effect?.type === "revive";

    /* El mensaje ocurre ANTES del efecto, igual que en Battle. */
    this.showFeedback(`Used a ${item.name}!`);

    /* Party permanece como superficie principal mientras ocurre toda la presentación del healing item. */
    this.partyDrawer.show();

    try {
      await this.partyDrawer.animateHpRestore(
        payload.targetPokemonInstanceId,
        payload.previousHp,
        payload.currentHp,
        isRevive,
        760,
      );

      await this.wait(600);
    } catch (error: unknown) {
      /* Un error puramente visual jamás debe impedir aplicar el TrainerState autoritativo */
      console.error(
        "[OverworldItemPresentation] HP restore animation failed",
        error,
      );
    } finally {
      /* Primero aplicamos cualquier Party autoritativa diferida y liberamos el presentation lock */
      this.finishOverworldItemPresentation();

      /* Después restauramos la superficie desde la cual comenzó originalmente el flujo */
      this.partyDrawer.hide();
      this.inventoryDrawer.show();
    }
  }

  public handleOverworldItemError(
    payload: PokemonOverworldItemErrorPayload,
  ): void {
    this.finishOverworldItemPresentation();
    this.showFeedback(this.getOverworldItemErrorMessage(payload.code));
  }

  public toggleInventory(): void {
    if (this.isPartyReorderPending || this.partyDrawer.isReorderMode()) {
      return;
    }

    if (this.selectedOverworldItemId || this.isOverworldItemUsePending) {
      return;
    }

    if (this.isInteractionBlocked()) {
      return;
    }

    const willOpen = !this.inventoryDrawer.isVisible();

    if (willOpen) {
      this.partyDrawer.hide();
      this.trainerDrawer.hide();
    }

    this.inventoryDrawer.toggle();
  }

  public toggleParty(): void {
    if (this.isPartyReorderPending) {
      return;
    }

    if (this.selectedOverworldItemId || this.isOverworldItemUsePending) {
      return;
    }

    if (this.isInteractionBlocked()) {
      return;
    }

    const willOpen = !this.partyDrawer.isVisible();

    if (willOpen) {
      this.inventoryDrawer.hide();
      this.trainerDrawer.hide();
    }

    if (!willOpen && this.partyDrawer.isReorderMode()) {
      this.exitPartyReorderMode();
    }

    /* PartyDrawer ya sabe si existe al menos un Pokémon */
    this.partyDrawer.toggle();
  }

  public toggleTrainer(): void {
    if (
      this.isPartyReorderPending ||
      this.partyDrawer.isReorderMode()
    ) {
      return;
    }

    if (
      this.selectedOverworldItemId ||
      this.isOverworldItemUsePending
    ) {
      return;
    }

    if (this.isInteractionBlocked()) {
      return;
    }

    const willOpen =
      !this.trainerDrawer.isVisible();

    if (willOpen) {
      this.partyDrawer.hide();
      this.inventoryDrawer.hide();
    }

    this.trainerDrawer.toggle();
  }

  private handlePartyDrawerCloseRequested(): void {
    if (this.selectedOverworldItemId) {
      this.cancelOverworldItemTargetSelection();
      return;
    }

    if (
      this.isOverworldItemUsePending ||
      this.isPartyReorderPending
    ) {
      return;
    }

    if (this.partyDrawer.isReorderMode()) {
      this.exitPartyReorderMode();
      return;
    }

    this.partyDrawer.hide();
  }

  private handleInventoryDrawerCloseRequested(): void {
    if (
      this.selectedOverworldItemId ||
      this.isOverworldItemUsePending ||
      this.isPartyReorderPending
    ) {
      return;
    }

    this.inventoryDrawer.hide();
  }

  private handleInventoryToggle(): void {
    if (!Phaser.Input.Keyboard.JustDown(this.inventoryKey)) {
      return;
    }

    this.toggleInventory();
  }

  private handlePartyToggle(): void {
    if (!Phaser.Input.Keyboard.JustDown(this.partyKey)) {
      return;
    }

    this.toggleParty();
  }

  private handleClose(): void {
    if (!Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
      return;
    }

    if (this.selectedOverworldItemId) {
      this.cancelOverworldItemTargetSelection();
      return;
    }

    if (this.isOverworldItemUsePending) {
      return;
    }

    if (this.isPartyReorderPending) {
      return;
    }

    if (this.partyDrawer.isReorderMode()) {
      this.exitPartyReorderMode();
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
    this.inventoryDrawer.hide();
    this.partyDrawer.setTargetSelectionMode(true);
    this.partyDrawer.show();
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

    this.pendingOverworldItemPresentation = {
      itemId,
      targetPokemonInstanceId: pokemon.instanceId,
      previousHp: pokemon.currentHp,
    };

    this.deferredPartyDuringOverworldItem = undefined;

    /* Intent solamente. Server continúa teniendo toda la autoridad */
    this.onUseOverworldItem({
      itemId,
      targetPokemonInstanceId: pokemon.instanceId,
    });

    this.selectedOverworldItemId = undefined;

    /* Salimos de target-selection para impedir un segundo click, pero mantenemos Party visible */
    this.partyDrawer.setTargetSelectionMode(false);
    this.partyDrawer.show();
  }

  private cancelOverworldItemTargetSelection(): void {
    this.selectedOverworldItemId = undefined;
    this.partyDrawer.setTargetSelectionMode(false);
    this.partyDrawer.hide();
    this.inventoryDrawer.show();
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

      case "TARGET_NOT_FAINTED":
        return "Ese Pokémon no está debilitado.";

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

  private handlePartyReorderRequested(): void {
    if (
      this.selectedOverworldItemId ||
      this.isOverworldItemUsePending ||
      this.isPartyReorderPending
    ) {
      return;
    }

    if (!this.partyDrawer.isVisible()) {
      return;
    }

    if (this.isInteractionBlocked()) {
      return;
    }

    /*
     * Mobile/touch explicit reorder flow:
     * 1. enter reorder mode without a source;
     * 2. first Pokémon tap chooses the source;
     * 3. second Pokémon tap chooses the destination.
     *
     * Desktop keeps the existing contextual "Cambiar posición" flow.
     */
    this.partyReorderSourceInstanceId = undefined;

    this.partyDrawer.setReorderState({
      active: true,
      sourcePokemonInstanceId: undefined,
      pending: false,
    });
  }

  private handlePartyChangeRequested(pokemon: PokemonInstance): void {
    if (
      this.selectedOverworldItemId ||
      this.isOverworldItemUsePending ||
      this.isPartyReorderPending
    ) {
      return;
    }

    if (!this.partyDrawer.isVisible()) {
      return;
    }

    if (this.isInteractionBlocked()) {
      return;
    }

    /*
     * El Pokémon origen NO se elige en un segundo paso.
     * Ya fue seleccionado desde el menú contextual:
     * Pokémon A → CAMBIO → A pasa a ser source.
     */
    this.partyReorderSourceInstanceId = pokemon.instanceId;

    this.partyDrawer.setReorderState({
      active: true,
      sourcePokemonInstanceId: pokemon.instanceId,
      pending: false,
    });
  }

  private handlePartyPokemonSelected(
    pokemon: PokemonInstance,
    index: number,
  ): void {
    /* Item Target Selection mantiene prioridad y comportamiento actual */
    if (this.selectedOverworldItemId) {
      this.handleOverworldItemTargetSelected(pokemon);
      return;
    }

    if (!this.partyDrawer.isReorderMode()) {
      return;
    }

    if (this.isPartyReorderPending) {
      return;
    }

    const sourcePokemonInstanceId = this.partyReorderSourceInstanceId;

    /*
     * Explicit mobile reorder can enter the mode before choosing a source.
     * The first Pokémon tap becomes the source.
     */
    if (!sourcePokemonInstanceId) {
      this.partyReorderSourceInstanceId = pokemon.instanceId;
      this.refreshPartyReorderUi();
      return;
    }

    /* Tapping the source again deselects it instead of sending a no-op. */
    if (sourcePokemonInstanceId === pokemon.instanceId) {
      this.partyReorderSourceInstanceId = undefined;
      this.refreshPartyReorderUi();
      return;
    }

    this.isPartyReorderPending = true;
    this.refreshPartyReorderUi();
    this.onReorderParty({
      pokemonInstanceId: sourcePokemonInstanceId,
      targetPosition: index,
    });
  }

  private exitPartyReorderMode(): void {
    this.partyReorderSourceInstanceId = undefined;
    this.partyDrawer.setReorderState({
      active: false,
      sourcePokemonInstanceId: undefined,
      pending: false,
    });
  }

  private refreshPartyReorderUi(): void {
    this.partyDrawer.setReorderState({
      active: this.partyDrawer.isReorderMode(),
      sourcePokemonInstanceId: this.partyReorderSourceInstanceId,
      pending: this.isPartyReorderPending,
    });
  }

  public handlePokemonPartyReordered(
    _payload: PokemonPartyReorderedPayload,
  ): void {
    this.isPartyReorderPending = false;
    this.exitPartyReorderMode();
    this.showFeedback("Pokémon intercambiados correctamente.");
  }

  public handlePokemonPartyReorderError(
    payload: PokemonPartyReorderErrorPayload,
  ): void {
    this.isPartyReorderPending = false;
    this.exitPartyReorderMode();
    this.showFeedback(this.getPartyReorderErrorMessage(payload.code));
  }

  private getPartyReorderErrorMessage(
    code: PokemonPartyReorderErrorPayload["code"],
  ): string {
    switch (code) {
      case "INVALID_INPUT":
        return "No se pudo reordenar el equipo.";

      case "POKEMON_NOT_IN_PARTY":
        return "Ese Pokémon ya no está en tu equipo.";

      case "INVALID_POSITION":
        return "La posición de destino ya no es válida.";

      case "INCOMPATIBLE_STATE":
        return "No puedes reordenar el equipo en este momento.";

      case "PERSISTENCE_FAILED":
        return "No se pudo guardar el nuevo orden.";
    }
  }

  private wait(durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      this.scene.time.delayedCall(durationMs, resolve);
    });
  }

  private finishOverworldItemPresentation(): void {
    this.isOverworldItemUsePending = false;
    this.pendingOverworldItemPresentation = undefined;
    const deferredParty = this.deferredPartyDuringOverworldItem;
    this.deferredPartyDuringOverworldItem = undefined;

    if (deferredParty) {
      this.partyDrawer.setParty(deferredParty);
    }
  }
}
