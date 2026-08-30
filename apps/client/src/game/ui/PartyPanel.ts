import Phaser from "phaser";

import {
  getPokemonFormsBySpecies,
  getPokemonSpecies,
  type PokemonInstance,
} from "@cesar-mmo/shared";

import { getPokemonSpriteAsset } from "../pokemon/pokemon-sprite.registry";

import { UI_DEPTHS } from "./uiDepths";

const PARTY_PANEL_WIDTH = 220;
const PARTY_PANEL_MARGIN = 12;

const PARTY_HEADER_HEIGHT = 30;
const PARTY_SLOT_HEIGHT = 48;

export class PartyPanel {
  private readonly scene: Phaser.Scene;

  private readonly container: Phaser.GameObjects.Container;

  private hasPokemon = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.container = this.scene.add
      .container(0, 0)
      .setDepth(UI_DEPTHS.PANEL)
      .setScrollFactor(0)
      .setVisible(false);
  }

  public setParty(pokemon: readonly PokemonInstance[]): void {
    const wasVisible = this.container.visible;
    this.container.removeAll(true);
    this.hasPokemon = pokemon.length > 0;

    if (!this.hasPokemon) {
      this.container.setVisible(false);
      return;
    }

    const panelHeight = PARTY_HEADER_HEIGHT + pokemon.length * PARTY_SLOT_HEIGHT + 8;
    const x = this.scene.scale.width - PARTY_PANEL_WIDTH - PARTY_PANEL_MARGIN;
    const y = PARTY_PANEL_MARGIN;

    this.container.setPosition(x, y);

    const background = this.scene.add
      .rectangle(0, 0, PARTY_PANEL_WIDTH, panelHeight, 0x111827, 0.94)
      .setOrigin(0);

    const title = this.scene.add.text(12, 8, "PARTY", {
      fontFamily: "Arial",
      fontSize: "13px",
      color: "#ffffff",
      fontStyle: "bold",
    });

    this.container.add([background, title]);

    pokemon.forEach((instance, index) => {
      this.createPokemonSlot(instance, index);
    });

    this.container.setVisible(wasVisible);
  }

  public hide(): void {
    this.container.setVisible(false);
  }

  public show(): void {
    if (!this.hasPokemon) {
      return;
    }

    this.container.setVisible(true);
  }

  public toggle(): void {
    if (!this.hasPokemon) {
      return;
    }

    this.container.setVisible(!this.container.visible);
  }

  public isVisible(): boolean {
    return this.container.visible;
  }

  private createPokemonSlot(pokemon: PokemonInstance, index: number): void {
    const slotY = PARTY_HEADER_HEIGHT + index * PARTY_SLOT_HEIGHT;

    const species = getPokemonSpecies(pokemon.speciesId);

    if (!species) {
      throw new Error(
        `Pokémon species ${pokemon.speciesId} not found while rendering Party`
      );
    }

    const asset = getPokemonSpriteAsset(pokemon.speciesId, pokemon.formId);

    const maxHp = this.getPokemonMaxHp(pokemon);

    const hpRatio = Phaser.Math.Clamp(pokemon.currentHp / maxHp, 0, 1);

    const displayName = pokemon.nickname?.trim() || this.formatPokemonName(species.name);

    const icon = this.scene.add.image(30, slotY + 20, asset.textureKey);

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

    this.container.add([icon, name, level, hpLabel, hpBackground, hpFill]);
  }

  private getPokemonMaxHp(pokemon: PokemonInstance): number {
    const forms = getPokemonFormsBySpecies(pokemon.speciesId);

    const form = forms.find((candidate) => candidate.formId === pokemon.formId);

    if (!form) {
      throw new Error(
        `Pokémon form ${pokemon.formId} not found for species ${pokemon.speciesId}`
      );
    }

    return Math.floor((2 * form.baseStats.hp * pokemon.level) / 100) + pokemon.level + 10;
  }

  private formatPokemonName(name: string): string {
    return name
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }
}
