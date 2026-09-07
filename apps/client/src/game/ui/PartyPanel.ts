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
  readonly onPokemonSelected?: (pokemon: PokemonInstance) => void;
}

export class PartyPanel {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private hasPokemon = false;
  private readonly onPokemonSelected?: (pokemon: PokemonInstance) => void;
  private party: readonly PokemonInstance[] = [];
  private targetSelectionMode = false;
  private readonly pokemonIconTweens: Phaser.Tweens.Tween[] = [];

  constructor(scene: Phaser.Scene, options: PartyPanelOptions = {}) {
    this.scene = scene;
    this.onPokemonSelected = options.onPokemonSelected;

    this.container = this.scene.add
      .container(0, 0)
      .setDepth(TRAINER_PANEL.depth)
      .setScrollFactor(0)
      .setVisible(false);
  }

  public setParty(pokemon: readonly PokemonInstance[]): void {
    this.party = pokemon;
    const wasVisible = this.container.visible;
    this.clearPokemonIconTweens();
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
    const x = this.scene.scale.width - TRAINER_PANEL.width - TRAINER_PANEL.margin;
    const y = TRAINER_PANEL.margin;

    this.container.setPosition(x, y);

    const background = this.scene.add
      .rectangle(
        0,
        0,
        TRAINER_PANEL.width,
        panelHeight,
        TRAINER_PANEL.backgroundColor,
        0.96
      )
      .setOrigin(0)
      .setStrokeStyle(1, TRAINER_PANEL.borderColor);

    const title = this.scene.add.text(
      12,
      9,
      this.targetSelectionMode ? "ELIGE UN POKÉMON" : "EQUIPO",
      {
        fontFamily: "Arial",
        fontSize: "14px",
        color: TRAINER_PANEL.titleColor,
        fontStyle: "bold",
      }
    );

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

    const footer = this.scene.add.text(12, footerY + 8, "[I] Inventario     [P] Cerrar", {
      fontFamily: "Arial",
      fontSize: "9px",
      color: TRAINER_PANEL.secondaryColor,
    });

    this.container.add([footerSeparator, footer]);
    this.container.setScrollFactor(0, 0, true);
  }

  public hide(): void {
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

    const displayName = getPokemonDisplayName(pokemon);

    const rowWidth = TRAINER_PANEL.width - 12;

    const rowHeight = PARTY_SLOT_HEIGHT - 6;

    const row = this.scene.add
      .rectangle(
        6,
        slotY + 3,
        rowWidth,
        rowHeight,
        index % 2 === 0 ? TRAINER_PANEL.rowColor : TRAINER_PANEL.alternateRowColor,
        0.9
      )
      .setOrigin(0);

    const icon = this.scene.add.image(30, slotY + 20, asset.textureKey);

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

    const hpLabel = this.scene.add.text(
      58,
      slotY + 22,
      `HP ${pokemon.currentHp}/${maxHp}`,
      {
        fontFamily: "Arial",
        fontSize: "9px",
        color: "#d1d5db",
      }
    );

    const hpBackground = this.scene.add
      .rectangle(58, slotY + 39, 140, 5, 0x374151)
      .setOrigin(0, 0.5);

    const hpFill = this.scene.add
      .rectangle(58, slotY + 39, 140 * hpRatio, 5, 0x22c55e)
      .setOrigin(0, 0.5);

    /* Primero row entra en su parentContainer definitivo */
    this.container.add([row, icon, name, level, hpLabel, hpBackground, hpFill]);

    /* Sólo target-selection habilita interacción */
    if (!this.targetSelectionMode || !this.onPokemonSelected) {
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
      row.setStrokeStyle();
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

      this.onPokemonSelected?.(pokemon);
    });
  }

  public setTargetSelectionMode(active: boolean): void {
    if (this.targetSelectionMode === active) {
      return;
    }
    this.targetSelectionMode = active;
    /* Re-render preservando el Party, autoritativo recibido anteriormente */
    this.setParty(this.party);
  }

  public isTargetSelectionMode(): boolean {
    return this.targetSelectionMode;
  }

  private createPokemonIconIdleAnimation(
    icon: Phaser.GameObjects.Image,
    index: number
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
}
