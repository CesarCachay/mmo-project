import Phaser from "phaser";

import { POKEMON_STARTERS } from "@cesar-mmo/shared";
import { type PokemonStarterId } from "@cesar-mmo/shared";

import { POKEMON_STARTER_ASSETS } from "../pokemon/pokemon-starter-assets";

import { UI_DEPTHS } from "./uiDepths";

type StarterSelectionPanelOptions = {
  onSelect: (starterId: PokemonStarterId) => void;
};

type StarterRegion = "KANTO" | "JOHTO" | "HOENN" | "SINNOH";

const STARTERS_BY_REGION: Record<StarterRegion, PokemonStarterId[]> = {
  KANTO: ["BULBASAUR", "CHARMANDER", "SQUIRTLE"],

  JOHTO: ["CHIKORITA", "CYNDAQUIL", "TOTODILE"],

  HOENN: ["TREECKO", "TORCHIC", "MUDKIP"],

  SINNOH: ["TURTWIG", "CHIMCHAR", "PIPLUP"],
};

export class StarterSelectionPanel {
  private readonly scene: Phaser.Scene;
  private readonly onSelect: (starterId: PokemonStarterId) => void;

  private readonly root: Phaser.GameObjects.Container;
  private readonly background: Phaser.GameObjects.Rectangle;
  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly subtitle: Phaser.GameObjects.Text;

  private readonly content: Phaser.GameObjects.Container;

  private selectionPending = false;

  constructor(scene: Phaser.Scene, options: StarterSelectionPanelOptions) {
    this.scene = scene;
    this.onSelect = options.onSelect;

    const { width, height } = scene.scale;

    this.background = scene.add
      .rectangle(0, 0, width, height, 0x000000, 0.55)
      .setOrigin(0)
      .setScrollFactor(0);

    this.panel = scene.add
      .rectangle(width / 2, height / 2, 520, 320, 0x1f2937, 0.95)
      .setStrokeStyle(2, 0xffffff)
      .setScrollFactor(0);

    this.title = scene.add
      .text(width / 2, height / 2 - 135, "Choose your starter", {
        fontFamily: "Arial",
        fontSize: "22px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.subtitle = scene.add
      .text(width / 2, height / 2 - 108, "Select one Pokémon to begin your journey", {
        fontFamily: "Arial",
        fontSize: "12px",
        color: "#d1d5db",
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.root = scene.add
      .container(0, 0, [this.background, this.panel, this.title, this.subtitle])
      .setDepth(UI_DEPTHS.MODAL)
      .setVisible(false);

    this.content = scene.add.container(0, 0);
    this.root.add(this.content);
    this.showRegionSelection();
  }

  public show(): void {
    this.showRegionSelection();
    this.root.setVisible(true);
  }

  public hide(): void {
    this.root.setVisible(false);
  }

  public isVisible(): boolean {
    return this.root.visible;
  }

  private getStarterDisplayName(starterId: PokemonStarterId): string {
    const normalized = starterId.toLowerCase();

    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  private showStarterSelection(region: StarterRegion): void {
    this.content.removeAll(true);

    this.title.setText(`${region} starters`);

    this.subtitle.setText("Choose your first Pokémon");

    const starters = STARTERS_BY_REGION[region];

    const { width, height } = this.scene.scale;

    const cardWidth = 150;
    const cardHeight = 150;
    const gap = 20;

    const totalWidth = cardWidth * starters.length + gap * (starters.length - 1);

    const startX = width / 2 - totalWidth / 2 + cardWidth / 2;

    starters.forEach((starterId, index) => {
      const x = startX + index * (cardWidth + gap);
      const y = height / 2;

      const asset = POKEMON_STARTER_ASSETS[starterId];
      const starter = POKEMON_STARTERS[starterId];
      const displayName = this.getStarterDisplayName(starterId);

      const cardBg = this.scene.add
        .rectangle(x, y, cardWidth, cardHeight, 0x374151, 1)
        .setStrokeStyle(1, 0xffffff)
        .setScrollFactor(0)
        .setInteractive({
          useHandCursor: true,
        });

      const sprite = this.scene.add
        .image(x, y - 25, asset.textureKey)
        .setDisplaySize(72, 72)
        .setScrollFactor(0)
        .setScale(1.5);
      const baseScaleX = sprite.scaleX;
      const baseScaleY = sprite.scaleY;

      const nameLabel = this.scene.add
        .text(x, y + 42, displayName, {
          fontFamily: "Arial",
          fontSize: "14px",
          color: "#ffffff",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setScrollFactor(0);

      const levelLabel = this.scene.add
        .text(x, y + 60, `Lv. ${starter.level}`, {
          fontFamily: "Arial",
          fontSize: "11px",
          color: "#d1d5db",
        })
        .setOrigin(0.5)
        .setScrollFactor(0);

      cardBg.on("pointerover", () => {
        cardBg.setFillStyle(0x4b5563, 1);
        sprite.setScale(baseScaleX * 1.08, baseScaleY * 1.08);
      });

      cardBg.on("pointerout", () => {
        cardBg.setFillStyle(0x374151, 1);
        sprite.setScale(baseScaleX, baseScaleY);
      });

      cardBg.on("pointerdown", () => {
        if (this.selectionPending) {
          return;
        }
        this.setSelectionPending(true);
        this.onSelect(starterId);
      });

      this.content.add([cardBg, sprite, nameLabel, levelLabel]);
    });

    this.createBackButton(width / 2, height / 2 + 105);
  }

  private showRegionSelection(): void {
    this.content.removeAll(true);
    this.title.setText("Choose your region");
    this.subtitle.setText("Select the region of your first Pokémon");

    const regions: StarterRegion[] = ["KANTO", "JOHTO", "HOENN", "SINNOH"];

    const { width, height } = this.scene.scale;

    const buttonWidth = 180;
    const buttonHeight = 70;

    const horizontalGap = 24;
    const verticalGap = 20;

    regions.forEach((region, index) => {
      const row = Math.floor(index / 2);
      const col = index % 2;

      const x =
        width / 2 +
        (col === 0
          ? -(buttonWidth / 2 + horizontalGap / 2)
          : buttonWidth / 2 + horizontalGap / 2);

      const y = height / 2 - 20 + row * (buttonHeight + verticalGap);

      const background = this.scene.add
        .rectangle(x, y, buttonWidth, buttonHeight, 0x374151, 1)
        .setStrokeStyle(1, 0xffffff)
        .setScrollFactor(0)
        .setInteractive({
          useHandCursor: true,
        });

      const label = this.scene.add
        .text(x, y, region, {
          fontFamily: "Arial",
          fontSize: "18px",
          color: "#ffffff",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setScrollFactor(0);

      background.on("pointerover", () => {
        background.setFillStyle(0x4b5563, 1);
      });

      background.on("pointerout", () => {
        background.setFillStyle(0x374151, 1);
      });

      background.on("pointerdown", () => {
        this.showStarterSelection(region);
      });

      this.content.add([background, label]);
    });
  }

  private createBackButton(x: number, y: number): void {
    const background = this.scene.add
      .rectangle(x, y, 100, 32, 0x1f2937, 1)
      .setStrokeStyle(1, 0xffffff)
      .setScrollFactor(0)
      .setInteractive({
        useHandCursor: true,
      });

    const label = this.scene.add
      .text(x, y, "← Back", {
        fontFamily: "Arial",
        fontSize: "12px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    background.on("pointerdown", () => {
      if (this.selectionPending) {
        return;
      }
      this.showRegionSelection();
    });

    this.content.add([background, label]);
  }

  public setSelectionPending(pending: boolean): void {
    this.selectionPending = pending;
    this.content.setAlpha(pending ? 0.6 : 1);

    if (pending) {
      this.subtitle.setText("Confirming selection...");
    }
  }
}
