import Phaser from "phaser";

import { getPokemonItem } from "@cesar-mmo/shared";

import type {
  PokemonInventory,
  PokemonInventoryItemStack,
  PokemonItemId,
} from "@cesar-mmo/shared";

import { TRAINER_PANEL } from "./trainerPanelStyles";

import { getPokemonItemIconAsset } from "../items/pokemon-item-icon.registry";

const INVENTORY_SLOT_HEIGHT = 52;
const INVENTORY_EMPTY_HEIGHT = 64;

export interface InventoryPanelOptions {
  readonly onItemSelected?: (itemId: PokemonItemId) => void;
}

export class InventoryPanel {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private inventory: PokemonInventory = {
    items: [],
  };

  private readonly onItemSelected?: (itemId: PokemonItemId) => void;

  constructor(scene: Phaser.Scene, options: InventoryPanelOptions = {}) {
    this.scene = scene;
    this.onItemSelected = options.onItemSelected;
    this.container = this.scene.add
      .container(0, 0)
      .setDepth(TRAINER_PANEL.depth)
      .setScrollFactor(0)
      .setVisible(false);
  }

  public setInventory(inventory: PokemonInventory): void {
    const wasVisible = this.container.visible;
    this.inventory = inventory;
    this.render();
    this.container.setVisible(wasVisible);
  }

  public show(): void {
    this.container.setVisible(true);
  }

  public hide(): void {
    this.container.setVisible(false);
  }

  public toggle(): void {
    this.container.setVisible(!this.container.visible);
  }

  public isVisible(): boolean {
    return this.container.visible;
  }

  private render(): void {
    this.container.removeAll(true);

    const items = this.inventory.items;

    const contentHeight =
      items.length > 0 ? items.length * INVENTORY_SLOT_HEIGHT : INVENTORY_EMPTY_HEIGHT;
    const panelHeight =
      TRAINER_PANEL.headerHeight + contentHeight + TRAINER_PANEL.footerHeight;

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

    const title = this.scene.add.text(12, 9, "INVENTARIO", {
      fontFamily: "Arial",
      fontSize: "14px",
      color: TRAINER_PANEL.titleColor,
      fontStyle: "bold",
    });

    const shortcut = this.scene.add
      .text(TRAINER_PANEL.width - 12, 10, "[I]", {
        fontFamily: "Arial",
        fontSize: "11px",
        color: TRAINER_PANEL.secondaryColor,
      })
      .setOrigin(1, 0);

    const headerSeparator = this.scene.add
      .rectangle(
        0,
        TRAINER_PANEL.headerHeight - 1,
        TRAINER_PANEL.width,
        1,
        TRAINER_PANEL.borderColor
      )
      .setOrigin(0);

    this.container.add([background, title, shortcut, headerSeparator]);

    if (items.length === 0) {
      this.renderEmptyState();
    } else {
      items.forEach((stack, index) => {
        this.renderItem(stack, index);
      });
    }

    const footerY = panelHeight - TRAINER_PANEL.footerHeight;

    const footerSeparator = this.scene.add
      .rectangle(0, footerY, TRAINER_PANEL.width, 1, TRAINER_PANEL.borderColor)
      .setOrigin(0);

    const footer = this.scene.add.text(12, footerY + 8, "[P] Equipo     [I] Cerrar", {
      fontFamily: "Arial",
      fontSize: "9px",
      color: TRAINER_PANEL.secondaryColor,
    });

    this.container.add([footerSeparator, footer]);

    /*
     * Trainer Panel vive en
     * screen-space.
     *
     * Propagamos scrollFactor 0
     * también a todos los children.
     */
    this.container.setScrollFactor(0, 0, true);
  }

  private renderEmptyState(): void {
    const emptyText = this.scene.add
      .text(
        TRAINER_PANEL.width / 2,
        TRAINER_PANEL.headerHeight + 28,
        "No tienes objetos.",
        {
          fontFamily: "Arial",
          fontSize: "11px",
          color: TRAINER_PANEL.secondaryColor,
        }
      )
      .setOrigin(0.5);

    this.container.add(emptyText);
  }

  private renderItem(stack: PokemonInventoryItemStack, index: number): void {
    const item = getPokemonItem(stack.itemId);
    const iconAsset = getPokemonItemIconAsset(stack.itemId);
    const slotY = TRAINER_PANEL.headerHeight + index * INVENTORY_SLOT_HEIGHT;

    const rowWidth = TRAINER_PANEL.width - 12;
    const rowHeight = INVENTORY_SLOT_HEIGHT - 6;

    /*
     * -------------------------------------------------
     * PRESENTATION ROW
     * -------------------------------------------------
     *
     * Primero creamos el row.
     * Todavía NO habilitamos input.
     * Primero debe entrar al Container.
     */
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

    /*
     * El icono es
     * presentation-only.
     *
     * Si el asset no existe,
     * el item sigue apareciendo
     * con nombre/categoría/cantidad.
     */
    const hasIcon = this.scene.textures.exists(iconAsset.textureKey);

    let icon: Phaser.GameObjects.Image | undefined;

    if (hasIcon) {
      icon = this.scene.add
        .image(30, slotY + INVENTORY_SLOT_HEIGHT / 2, iconAsset.textureKey)
        .setDisplaySize(36, 36);
    }

    const name = this.scene.add.text(56, slotY + 10, item.name, {
      fontFamily: "Arial",
      fontSize: "12px",
      color: TRAINER_PANEL.textColor,
      fontStyle: "bold",
    });

    const category = this.scene.add.text(
      56,
      slotY + 29,
      this.formatCategory(item.category),
      {
        fontFamily: "Arial",
        fontSize: "9px",
        color: TRAINER_PANEL.secondaryColor,
      }
    );

    const quantity = this.scene.add
      .text(TRAINER_PANEL.width - 16, slotY + 18, `x${stack.quantity}`, {
        fontFamily: "Arial",
        fontSize: "12px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(1, 0);

    /*
     * -------------------------------------------------
     * MUY IMPORTANTE
     * -------------------------------------------------
     *
     * Primero agregamos TODOS los objetos
     * al Container.
     *
     * De esta manera row ya tiene su
     * parentContainer definitivo antes
     * de registrar el input.
     */
    this.container.add([row, ...(icon ? [icon] : []), name, category, quantity]);

    /*
     * -------------------------------------------------
     * ITEM SELECTION
     * -------------------------------------------------
     *
     * Sólo objetos permitidos para
     * overworld son seleccionables.
     *
     * Poké Ball, por ejemplo,
     * permanece read-only.
     */
    const canSelect =
      item.overworldUsable && stack.quantity > 0 && Boolean(this.onItemSelected);

    if (!canSelect) {
      return;
    }

    /*
     * Ahora que row YA pertenece al
     * Container configuramos su
     * interacción.
     */
    row.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(0, 0, rowWidth, rowHeight),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });

    /*
     * IMPORTANTE:
     *
     * El Container es screen-space,
     * pero también aplicamos
     * scrollFactor directamente al
     * hijo interactivo.
     */
    row.setScrollFactor(0, 0);

    row.on("pointerover", () => {
      row.setStrokeStyle(1, TRAINER_PANEL.borderColor);
    });

    row.on("pointerout", () => {
      row.setStrokeStyle();
    });

    row.on("pointerdown", () => {
      this.onItemSelected?.(stack.itemId);
    });
  }

  private formatCategory(category: string): string {
    switch (category) {
      case "medicine":
        return "Medicina";

      case "ball":
        return "Poké Ball";

      case "battle-item":
        return "Objeto de batalla";

      case "evolution":
        return "Evolución";

      case "held-item":
        return "Objeto equipado";

      case "key-item":
        return "Objeto clave";

      default:
        return "Objeto";
    }
  }
}
