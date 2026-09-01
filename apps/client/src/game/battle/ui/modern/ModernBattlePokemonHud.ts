import type { BattlePokemonState } from "@cesar-mmo/shared";

import {
  getPokemonDisplayName,
  getPokemonMaxHp,
} from "../../../pokemon/pokemon-presentation.utils";

import { getPokemonSpriteAsset } from "../../../pokemon/pokemon-sprite.registry";

export type ModernBattlePokemonHudSide = "trainer" | "wild";

export interface ModernBattlePokemonHudBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ModernBattlePokemonHudViewport {
  width: number;
  height: number;
}

export class ModernBattlePokemonHud {
  private readonly root: HTMLDivElement;

  private readonly sprite: HTMLImageElement;

  private readonly card: HTMLDivElement;

  private readonly name: HTMLDivElement;

  private readonly level: HTMLDivElement;

  private readonly hpText: HTMLSpanElement;

  private readonly hpFill: HTMLDivElement;

  constructor(parent: HTMLElement, side: ModernBattlePokemonHudSide) {
    this.root = document.createElement("div");

    this.root.className = ["battle-modern-hud", `battle-modern-hud--${side}`].join(" ");

    this.sprite = document.createElement("img");

    this.sprite.className = "battle-modern-hud__sprite";

    this.sprite.alt = "";

    this.card = document.createElement("div");

    this.card.className = ["battle-modern-hud__card", "battle-ui-modern__surface"].join(
      " "
    );

    const header = document.createElement("div");

    header.className = "battle-modern-hud__header";

    this.name = document.createElement("div");

    this.name.className = "battle-modern-hud__name";

    this.level = document.createElement("div");

    this.level.className = "battle-modern-hud__level";

    header.append(this.name, this.level);

    const hpHeader = document.createElement("div");

    hpHeader.className = "battle-modern-hud__hp-header";

    const hpLabel = document.createElement("span");

    hpLabel.className = "battle-modern-hud__hp-label";

    hpLabel.textContent = "HP";

    this.hpText = document.createElement("span");

    this.hpText.className = "battle-modern-hud__hp-text";

    hpHeader.append(hpLabel, this.hpText);

    const hpTrack = document.createElement("div");

    hpTrack.className = "battle-modern-hud__hp-track";

    this.hpFill = document.createElement("div");

    this.hpFill.className = "battle-modern-hud__hp-fill";

    hpTrack.appendChild(this.hpFill);

    this.card.append(header, hpHeader, hpTrack);

    this.root.append(this.sprite, this.card);

    parent.appendChild(this.root);

    this.clear();
  }

  public setBounds(
    bounds: ModernBattlePokemonHudBounds,
    viewport: ModernBattlePokemonHudViewport
  ): void {
    if (viewport.width <= 0 || viewport.height <= 0) {
      return;
    }

    const left = bounds.x - bounds.width / 2;

    const top = bounds.y - bounds.height / 2;

    this.root.style.left = `${(left / viewport.width) * 100}%`;

    this.root.style.top = `${(top / viewport.height) * 100}%`;

    this.root.style.width = `${(bounds.width / viewport.width) * 100}%`;

    this.root.style.height = `${(bounds.height / viewport.height) * 100}%`;
  }

  public setPokemon(state: BattlePokemonState): void {
    const pokemon = state.pokemon;

    const maxHp = getPokemonMaxHp(pokemon);

    const currentHp = Math.max(0, state.currentHp);

    const hpRatio = maxHp > 0 ? Math.max(0, Math.min(1, currentHp / maxHp)) : 0;

    const asset = getPokemonSpriteAsset(pokemon.speciesId, pokemon.formId);

    this.name.textContent = getPokemonDisplayName(pokemon);

    this.level.textContent = `Lv. ${pokemon.level}`;

    this.hpText.textContent = `${currentHp} / ${maxHp}`;

    this.hpFill.style.width = `${hpRatio * 100}%`;

    this.hpFill.classList.remove(
      "battle-modern-hud__hp-fill--healthy",
      "battle-modern-hud__hp-fill--warning",
      "battle-modern-hud__hp-fill--danger"
    );

    if (hpRatio > 0.5) {
      this.hpFill.classList.add("battle-modern-hud__hp-fill--healthy");
    } else if (hpRatio > 0.2) {
      this.hpFill.classList.add("battle-modern-hud__hp-fill--warning");
    } else {
      this.hpFill.classList.add("battle-modern-hud__hp-fill--danger");
    }

    this.sprite.src = asset.path;

    this.sprite.alt = this.name.textContent;

    this.root.hidden = false;
  }

  public clear(): void {
    this.root.hidden = true;

    this.name.textContent = "";
    this.level.textContent = "";
    this.hpText.textContent = "";

    this.hpFill.style.width = "0%";

    this.sprite.removeAttribute("src");

    this.sprite.alt = "";
  }

  public destroy(): void {
    this.root.remove();
  }
}
