import Phaser from "phaser";

import type { PokemonInstance } from "@cesar-mmo/shared";

import {
  getPokemonDisplayName,
  getPokemonMaxHp,
} from "../pokemon/pokemon-presentation.utils";

import { getPokemonSpriteAsset } from "../pokemon/pokemon-sprite.registry";

import { TRAINER_PANEL } from "./trainerPanelStyles";

const PARTY_HEADER_HEIGHT = TRAINER_PANEL.headerHeight;
const PARTY_SLOT_HEIGHT = 52;

export interface PartyPanelOptions {
  readonly onPokemonSelected?: (
    pokemon: PokemonInstance,
    index: number,
  ) => void;
  readonly onChangeRequested?: (
    pokemon: PokemonInstance,
    index: number,
  ) => void;
}

export interface PartyPanelReorderState {
  readonly active: boolean;
  readonly sourcePokemonInstanceId: string | undefined;
  readonly pending: boolean;
}

interface PartySlotPresentation {
  readonly row: Phaser.GameObjects.Rectangle;
  readonly icon: Phaser.GameObjects.Image;
  readonly hpLabel: Phaser.GameObjects.Text;
  readonly hpFill: Phaser.GameObjects.Rectangle;
  readonly faintedLabel: Phaser.GameObjects.Text;
  readonly maxHp: number;
}

export class PartyPanel {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private hasPokemon = false;

  // 2. Field interno
  private readonly onPokemonSelected?: (
    pokemon: PokemonInstance,
    index: number,
  ) => void;
  private readonly onChangeRequested?: (
    pokemon: PokemonInstance,
    index: number,
  ) => void;

  private party: readonly PokemonInstance[] = [];
  private targetSelectionMode = false;

  private reorderMode = false;
  private reorderSourcePokemonInstanceId: string | undefined;
  private reorderPending = false;

  private contextMenuPokemonInstanceId: string | undefined;

  private readonly pokemonIconTweens: Phaser.Tweens.Tween[] = [];

  private readonly slotPresentations = new Map<string, PartySlotPresentation>();

  constructor(scene: Phaser.Scene, options: PartyPanelOptions = {}) {
    this.scene = scene;
    this.onPokemonSelected = options.onPokemonSelected;
    this.onChangeRequested = options.onChangeRequested;
    this.container = this.scene.add
      .container(0, 0)
      .setDepth(TRAINER_PANEL.depth)
      .setScrollFactor(0)
      .setVisible(false);
  }

  public setParty(pokemon: readonly PokemonInstance[]): void {
    this.party = pokemon;

    if (
      this.contextMenuPokemonInstanceId &&
      !pokemon.some(
        (instance) => instance.instanceId === this.contextMenuPokemonInstanceId,
      )
    ) {
      this.contextMenuPokemonInstanceId = undefined;
    }

    const wasVisible = this.container.visible;
    this.clearPokemonIconTweens();
    this.slotPresentations.clear();
    this.container.removeAll(true);
    this.hasPokemon = pokemon.length > 0;

    if (!this.hasPokemon) {
      this.container.setVisible(false);
      return;
    }

    const panelHeight =
      PARTY_HEADER_HEIGHT +
      pokemon.length * PARTY_SLOT_HEIGHT +
      TRAINER_PANEL.footerHeight;
    const x =
      this.scene.scale.width - TRAINER_PANEL.width - TRAINER_PANEL.margin;
    const y = TRAINER_PANEL.margin;

    this.container.setPosition(x, y);

    const background = this.scene.add
      .rectangle(
        0,
        0,
        TRAINER_PANEL.width,
        panelHeight,
        TRAINER_PANEL.backgroundColor,
        0.96,
      )
      .setOrigin(0)
      .setStrokeStyle(1, TRAINER_PANEL.borderColor);

    const titleText = this.getTitleText();

    const title = this.scene.add.text(12, 9, titleText, {
      fontFamily: "Arial",
      fontSize: "14px",
      color: TRAINER_PANEL.titleColor,
      fontStyle: "bold",
    });

    const shortcut = this.scene.add
      .text(TRAINER_PANEL.width - 12, 10, "[P]", {
        fontFamily: "Arial",
        fontSize: "11px",
        color: TRAINER_PANEL.secondaryColor,
      })
      .setOrigin(1, 0);

    this.container.add([background, title, shortcut]);

    pokemon.forEach((instance, index) => {
      this.createPokemonSlot(instance, index);
    });

    this.container.setVisible(wasVisible);

    const footerY = panelHeight - TRAINER_PANEL.footerHeight;

    const footerSeparator = this.scene.add
      .rectangle(0, footerY, TRAINER_PANEL.width, 1, TRAINER_PANEL.borderColor)
      .setOrigin(0);

    const footer = this.scene.add.text(12, footerY + 8, this.getFooterText(), {
      fontFamily: "Arial",
      fontSize: "9px",
      color: TRAINER_PANEL.secondaryColor,
    });

    this.container.add([footerSeparator, footer]);
    this.createPokemonContextMenu();
    this.container.setScrollFactor(0, 0, true);
  }

  public hide(): void {
    this.contextMenuPokemonInstanceId = undefined;
    this.container.setVisible(false);
    this.pausePokemonIconAnimations();
  }

  public show(): void {
    if (!this.hasPokemon) {
      return;
    }
    this.container.setVisible(true);
    this.resumePokemonIconAnimations();
  }

  public toggle(): void {
    if (!this.hasPokemon) {
      return;
    }

    const willShow = !this.container.visible;
    this.container.setVisible(willShow);

    if (willShow) {
      this.resumePokemonIconAnimations();
    } else {
      this.contextMenuPokemonInstanceId = undefined;
      this.pausePokemonIconAnimations();
    }
  }

  public isVisible(): boolean {
    return this.container.visible;
  }

  private createPokemonSlot(pokemon: PokemonInstance, index: number): void {
    const slotY = PARTY_HEADER_HEIGHT + index * PARTY_SLOT_HEIGHT;

    const asset = getPokemonSpriteAsset(pokemon.speciesId, pokemon.formId);

    const maxHp = getPokemonMaxHp(pokemon);

    const hpRatio = Phaser.Math.Clamp(pokemon.currentHp / maxHp, 0, 1);

    const isFainted = pokemon.currentHp <= 0;

    const displayName = getPokemonDisplayName(pokemon);

    const rowWidth = TRAINER_PANEL.width - 12;

    const rowHeight = PARTY_SLOT_HEIGHT - 6;

    const row = this.scene.add
      .rectangle(
        6,
        slotY + 3,
        rowWidth,
        rowHeight,
        index % 2 === 0
          ? TRAINER_PANEL.rowColor
          : TRAINER_PANEL.alternateRowColor,
        0.9,
      )
      .setOrigin(0);

    if (isFainted) {
      row.setAlpha(0.72);
      row.setStrokeStyle(1, 0x7f1d1d, 0.9);
    }

    const isReorderSource =
      this.reorderMode &&
      this.reorderSourcePokemonInstanceId === pokemon.instanceId;

    const isContextSelected =
      !this.targetSelectionMode &&
      !this.reorderMode &&
      this.contextMenuPokemonInstanceId === pokemon.instanceId;

    if (isReorderSource) {
      row.setStrokeStyle(2, 0xfacc15);
    }

    if (isContextSelected) {
      row.setStrokeStyle(2, 0x60a5fa);
    }

    if (this.reorderPending) {
      row.setAlpha(0.72);
    }

    const icon = this.scene.add.image(30, slotY + 20, asset.textureKey);

    if (isFainted) {
      /* Presentation-only. No altera gameplay ni PokemonInstance */
      icon.setTint(0x6b7280).setAlpha(0.58);
    }

    this.createPokemonIconIdleAnimation(icon, index);

    const name = this.scene.add.text(58, slotY + 5, displayName, {
      fontFamily: "Arial",
      fontSize: "12px",
      color: "#ffffff",
    });

    const level = this.scene.add.text(160, slotY + 5, `Lv. ${pokemon.level}`, {
      fontFamily: "Arial",
      fontSize: "11px",
      color: "#d1d5db",
    });

    const faintedLabel = this.scene.add
      .text(TRAINER_PANEL.width - 18, slotY + 6, "FAINTED", {
        fontFamily: "Arial",
        fontSize: "9px",
        color: "#fca5a5",
        fontStyle: "bold",
      })
      .setOrigin(1, 0)
      .setVisible(isFainted);

    const hpLabel = this.scene.add.text(
      58,
      slotY + 22,
      `HP ${pokemon.currentHp}/${maxHp}`,
      {
        fontFamily: "Arial",
        fontSize: "9px",
        color: "#d1d5db",
      },
    );

    const hpBackground = this.scene.add
      .rectangle(58, slotY + 39, 140, 5, 0x374151)
      .setOrigin(0, 0.5);

    const hpFill = this.scene.add
      .rectangle(58, slotY + 39, 140, 5, 0x22c55e)
      .setOrigin(0, 0.5)
      .setScale(hpRatio, 1);

    /* Primero row entra en su parentContainer definitivo */
    this.container.add([
      row,
      icon,
      name,
      level,
      hpLabel,
      hpBackground,
      hpFill,
      faintedLabel,
    ]);
    this.slotPresentations.set(pokemon.instanceId, {
      row,
      icon,
      hpLabel,
      hpFill,
      faintedLabel,
      maxHp,
    });

    const isSpecialSelectionMode = this.targetSelectionMode || this.reorderMode;

    const canInteract =
      !this.reorderPending &&
      (!isSpecialSelectionMode || Boolean(this.onPokemonSelected));

    if (!canInteract) {
      return;
    }

    /* Configurar input DESPUÉS de agregar el row al Container */
    row.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(0, 0, rowWidth, rowHeight),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });

    /* Igual que InventoryPanel: fijar directamente el hijo interactivo a screen-space */
    row.setScrollFactor(0, 0);

    const baseScaleX = icon.scaleX;
    const baseScaleY = icon.scaleY;

    row.on("pointerover", () => {
      row.setStrokeStyle(1, TRAINER_PANEL.borderColor);
      this.scene.tweens.add({
        targets: icon,
        scaleX: icon.scaleX * 1.08,
        scaleY: icon.scaleY * 1.08,
        duration: 55,
        ease: "Quad.Out",
      });
    });

    row.on("pointerout", () => {
      if (isReorderSource) {
        row.setStrokeStyle(2, 0xfacc15);
      } else if (isContextSelected) {
        row.setStrokeStyle(2, 0x60a5fa);
      } else if (isFainted) {
        row.setStrokeStyle(1, 0x7f1d1d, 0.9);
      } else {
        row.setStrokeStyle();
      }
      this.scene.tweens.add({
        targets: icon,
        scaleX: baseScaleX,
        scaleY: baseScaleY,
        duration: 65,
        ease: "Quad.Out",
      });
    });

    row.on("pointerdown", () => {
      this.scene.tweens.add({
        targets: icon,
        scaleX: baseScaleX * 0.92,
        scaleY: baseScaleY * 0.92,
        duration: 35,
        yoyo: true,
        ease: "Quad.Out",
      });

      // 3. Invocación
      if (this.targetSelectionMode || this.reorderMode) {
        this.onPokemonSelected?.(pokemon, index);
        return;
      }

      /* En Party normal: click Pokémon → menú contextual */
      this.openPokemonContextMenu(pokemon.instanceId);
    });
  }

  public animateHpRestore(
    pokemonInstanceId: string,
    previousHp: number,
    currentHp: number,
    isRevive: boolean,
    durationMs = 760,
  ): Promise<void> {
    const slot = this.slotPresentations.get(pokemonInstanceId);

    if (!slot || !this.container.visible) {
      return Promise.resolve();
    }

    const fromHp = Phaser.Math.Clamp(previousHp, 0, slot.maxHp);

    const toHp = Phaser.Math.Clamp(currentHp, 0, slot.maxHp);

    if (toHp <= fromHp) {
      return Promise.resolve();
    }

    const prefersReducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    const safeDuration = prefersReducedMotion ? 0 : Math.max(0, durationMs);

    const fxColor = isRevive ? 0xfacc15 : 0x4ade80;

    /* Presentation siempre empieza desde el HP anterior confirmado. */
    this.updateSlotHpVisual(slot, fromHp);

    if (safeDuration === 0) {
      this.updateSlotHpVisual(slot, toHp);
      slot.row.setAlpha(1);
      slot.row.setStrokeStyle();
      slot.icon.clearTint().setAlpha(1);

      if (fromHp === 0 && toHp > 0) {
        slot.faintedLabel.setVisible(false);
      }

      return Promise.resolve();
    }

    /* Focus visual del target */
    slot.row.setStrokeStyle(2, fxColor, 0.95);

    slot.icon.setTint(fxColor);

    /* Ring alrededor del sprite */
    const ring = this.scene.add
      .circle(slot.icon.x, slot.icon.y, 17, fxColor, 0)
      .setStrokeStyle(2, fxColor, 0.9)
      .setScale(0.4)
      .setAlpha(0.9);

    this.container.add(ring);

    this.scene.tweens.add({
      targets: ring,
      scaleX: 1.55,
      scaleY: 1.55,
      alpha: 0,
      duration: safeDuration,
      ease: "Cubic.Out",
      onComplete: () => {
        ring.destroy();
      },
    });

    for (let index = 0; index < 7; index += 1) {
      const offsetX = Phaser.Math.Between(-18, 18);

      const particle = this.scene.add
        .circle(
          slot.icon.x + offsetX,
          slot.icon.y + 15,
          Phaser.Math.Between(2, 3),
          fxColor,
          1,
        )
        .setAlpha(0);

      this.container.add(particle);

      this.scene.tweens.add({
        targets: particle,
        x: particle.x + Phaser.Math.Between(-6, 6),
        y: particle.y - Phaser.Math.Between(28, 46),
        alpha: {
          from: 0.95,
          to: 0,
        },
        scaleX: {
          from: 0.55,
          to: 1.2,
        },
        scaleY: {
          from: 0.55,
          to: 1.2,
        },
        duration: Math.max(280, safeDuration - Phaser.Math.Between(0, 130)),
        delay: index * 45,
        ease: "Cubic.Out",
        onComplete: () => {
          particle.destroy();
        },
      });
    }

    /* Pequeño glow/pulse del icono */
    this.scene.tweens.add({
      targets: slot.icon,
      alpha: {
        from: 0.72,
        to: 1,
      },
      duration: Math.floor(safeDuration / 2),
      yoyo: true,
      ease: "Sine.InOut",
    });

    /* HP count-up */
    const counter = {
      value: fromHp,
    };

    return new Promise<void>((resolve) => {
      this.scene.tweens.add({
        targets: counter,
        value: toHp,
        duration: safeDuration,
        ease: "Cubic.Out",
        onUpdate: () => {
          this.updateSlotHpVisual(slot, Math.round(counter.value));
        },
        onComplete: () => {
          this.updateSlotHpVisual(slot, toHp);
          slot.row.setAlpha(1).setStrokeStyle();
          slot.icon.clearTint().setAlpha(1);

          /* Si el Pokémon estaba debilitado y ahora vuelve a tener HP, deja de mostrarse FAINTED */
          if (fromHp === 0 && toHp > 0) {
            slot.faintedLabel.setVisible(false);
          }

          resolve();
        },
      });
    });
  }

  public setTargetSelectionMode(active: boolean): void {
    if (this.targetSelectionMode === active && (!active || !this.reorderMode)) {
      return;
    }

    this.targetSelectionMode = active;

    if (active) {
      this.contextMenuPokemonInstanceId = undefined;
      this.reorderMode = false;
      this.reorderSourcePokemonInstanceId = undefined;
      this.reorderPending = false;
    }

    this.setParty(this.party);
  }

  public isTargetSelectionMode(): boolean {
    return this.targetSelectionMode;
  }

  public setReorderState(state: PartyPanelReorderState): void {
    const changed =
      this.reorderMode !== state.active ||
      this.reorderSourcePokemonInstanceId !== state.sourcePokemonInstanceId ||
      this.reorderPending !== state.pending;

    if (!changed) {
      return;
    }

    this.reorderMode = state.active;
    this.reorderSourcePokemonInstanceId = state.sourcePokemonInstanceId;
    this.reorderPending = state.pending;

    if (state.active) {
      this.contextMenuPokemonInstanceId = undefined;
      this.targetSelectionMode = false;
    }

    this.setParty(this.party);
  }

  public isReorderMode(): boolean {
    return this.reorderMode;
  }

  private createPokemonIconIdleAnimation(
    icon: Phaser.GameObjects.Image,
    index: number,
  ): void {
    const baseY = icon.y;
    const tween = this.scene.tweens.add({
      targets: icon,
      y: baseY - 2,
      duration: 360 + index * 25,
      delay: index * 50,
      ease: "Sine.InOut",
      yoyo: true,
      repeat: -1,
      paused: !this.container.visible,
    });
    this.pokemonIconTweens.push(tween);
  }

  private pausePokemonIconAnimations(): void {
    for (const tween of this.pokemonIconTweens) {
      tween.pause();
    }
  }

  private resumePokemonIconAnimations(): void {
    for (const tween of this.pokemonIconTweens) {
      tween.resume();
    }
  }

  private clearPokemonIconTweens(): void {
    for (const tween of this.pokemonIconTweens) {
      tween.stop();
      tween.remove();
    }

    this.pokemonIconTweens.length = 0;
  }

  private getTitleText(): string {
    if (this.targetSelectionMode) {
      return "ELIGE UN POKÉMON";
    }

    if (this.reorderPending) {
      return "GUARDANDO ORDEN...";
    }

    if (this.reorderMode) {
      return "ELIGE DESTINO";
    }

    return "EQUIPO";
  }

  private getFooterText(): string {
    if (this.targetSelectionMode) {
      return "[ESC] Volver";
    }

    if (this.reorderMode) {
      if (this.reorderPending) {
        return "Guardando...";
      }

      return "[ESC] Cancelar";
    }

    return "[I] Inventario     [P] Cerrar";
  }

  private openPokemonContextMenu(pokemonInstanceId: string): void {
    this.contextMenuPokemonInstanceId = pokemonInstanceId;

    this.setParty(this.party);
  }

  private closePokemonContextMenu(): void {
    if (!this.contextMenuPokemonInstanceId) {
      return;
    }

    this.contextMenuPokemonInstanceId = undefined;

    this.setParty(this.party);
  }

  private createPokemonContextMenu(): void {
    const pokemonInstanceId = this.contextMenuPokemonInstanceId;

    if (
      !pokemonInstanceId ||
      this.targetSelectionMode ||
      this.reorderMode ||
      this.reorderPending
    ) {
      return;
    }

    const pokemonIndex = this.party.findIndex(
      (pokemon) => pokemon.instanceId === pokemonInstanceId,
    );

    if (pokemonIndex < 0) {
      this.contextMenuPokemonInstanceId = undefined;

      return;
    }

    const pokemon = this.party[pokemonIndex];

    if (!pokemon) {
      return;
    }

    const menuWidth = 108;
    const optionHeight = 24;

    const menuX = TRAINER_PANEL.width - menuWidth - 8;

    const menuY = PARTY_HEADER_HEIGHT + 8;

    const options = [
      {
        label: "DATOS",
        action: "summary",
        enabled: false,
      },
      {
        label: "CAMBIO",
        action: "change",
        enabled: Boolean(this.onChangeRequested),
      },
      {
        label: "OBJETO",
        action: "item",
        enabled: false,
      },
      {
        label: "SALIR",
        action: "exit",
        enabled: true,
      },
    ] as const;

    const menuHeight = options.length * optionHeight + 8;

    const background = this.scene.add
      .rectangle(menuX, menuY, menuWidth, menuHeight, 0xf3f4f6, 1)
      .setOrigin(0)
      .setStrokeStyle(2, 0x475569);

    this.container.add(background);

    options.forEach((option, optionIndex) => {
      const optionY = menuY + 4 + optionIndex * optionHeight;

      const optionBackground = this.scene.add
        .rectangle(
          menuX + 4,
          optionY,
          menuWidth - 8,
          optionHeight - 2,
          0xffffff,
          0,
        )
        .setOrigin(0);

      const label = this.scene.add.text(menuX + 12, optionY + 4, option.label, {
        fontFamily: "Arial",
        fontSize: "12px",

        color: option.enabled ? "#111827" : "#9ca3af",

        fontStyle: option.action === "change" ? "bold" : "normal",
      });

      this.container.add([optionBackground, label]);

      if (!option.enabled) {
        return;
      }

      optionBackground
        .setInteractive({
          useHandCursor: true,
        })
        .setScrollFactor(0, 0);

      optionBackground.on("pointerover", () => {
        optionBackground.setFillStyle(0xdbeafe, 1);
      });

      optionBackground.on("pointerout", () => {
        optionBackground.setFillStyle(0xffffff, 0);
      });

      optionBackground.on("pointerdown", () => {
        switch (option.action) {
          case "change":
            this.onChangeRequested?.(pokemon, pokemonIndex);
            return;

          case "exit":
            this.closePokemonContextMenu();
            return;
        }
      });
    });
  }

  private updateSlotHpVisual(
    slot: PartySlotPresentation,
    currentHp: number,
  ): void {
    const safeHp = Phaser.Math.Clamp(Math.round(currentHp), 0, slot.maxHp);
    const hpRatio = slot.maxHp > 0 ? safeHp / slot.maxHp : 0;
    slot.hpLabel.setText(`HP ${safeHp}/${slot.maxHp}`);
    slot.hpFill.setScale(hpRatio, 1);
  }
}
