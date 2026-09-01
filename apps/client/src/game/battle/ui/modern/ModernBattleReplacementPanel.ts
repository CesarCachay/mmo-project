import type { BattleInstance, BattlePokemonState } from "@cesar-mmo/shared";

import {
  getPokemonDisplayName,
  getPokemonMaxHp,
} from "../../../pokemon/pokemon-presentation.utils";

import { getPokemonSpriteAsset } from "../../../pokemon/pokemon-sprite.registry";

import type { BattleClientInteractionState } from "../../battle-client.types";

export interface ModernBattleReplacementPanelBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ModernBattleReplacementPanelViewport {
  width: number;
  height: number;
}

export type ModernBattleReplacementPanelMode = "forced" | "voluntary";

interface ModernBattleReplacementPanelOptions {
  onPartyPokemonSelected: (pokemonIndex: number) => void;
  onBack: () => void;
}

interface ReplacementSlotEntry {
  button: HTMLButtonElement;
  pokemonIndex: number;
  selectable: boolean;
}

export class ModernBattleReplacementPanel {
  private readonly root: HTMLDivElement;
  private readonly title: HTMLDivElement;
  private readonly waitingLabel: HTMLDivElement;
  private readonly grid: HTMLDivElement;

  private readonly onPartyPokemonSelected: (pokemonIndex: number) => void;

  private interactionState: BattleClientInteractionState = "completed";

  private mode: ModernBattleReplacementPanelMode = "forced";

  private slots: ReplacementSlotEntry[] = [];

  private readonly backButton: HTMLButtonElement;

  constructor(parent: HTMLElement, options: ModernBattleReplacementPanelOptions) {
    this.onPartyPokemonSelected = options.onPartyPokemonSelected;

    this.root = document.createElement("div");
    this.root.className = [
      "battle-modern-replacement",
      "battle-ui-modern__interactive",
    ].join(" ");

    const header = document.createElement("div");
    header.className = "battle-modern-replacement__header";

    const headerLeft = document.createElement("div");
    headerLeft.className = "battle-modern-replacement__header-left";

    this.title = document.createElement("div");
    this.title.className = "battle-modern-replacement__title";
    this.title.textContent = "Choose your next Pokémon";

    this.waitingLabel = document.createElement("div");
    this.waitingLabel.className = "battle-modern-replacement__waiting";
    this.waitingLabel.textContent = "Switching Pokémon…";

    this.grid = document.createElement("div");
    this.grid.className = "battle-modern-replacement__grid";

    this.backButton = document.createElement("button");
    this.backButton.type = "button";
    this.backButton.className = "battle-replacement-panel__back";
    this.backButton.textContent = "BACK";
    this.backButton.addEventListener("click", () => {
      options.onBack();
    });

    headerLeft.append(this.backButton, this.title);
    header.append(headerLeft, this.waitingLabel);

    this.root.append(header, this.grid);
    parent.appendChild(this.root);

    this.updateBackButton();
    this.setVisible(false);
  }

  public setBounds(
    bounds: ModernBattleReplacementPanelBounds,
    viewport: ModernBattleReplacementPanelViewport
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

  public render(
    battle: BattleInstance,
    replacementPokemonIndexes: readonly number[]
  ): void {
    this.slots = [];

    this.grid.replaceChildren();

    const trainer = battle.participants.find(
      (participant) => participant.type === "trainer"
    );

    if (!trainer) {
      console.warn("[ModernBattleReplacementPanel] trainer participant missing", {
        battleId: battle.battleId,
      });

      return;
    }

    trainer.pokemon.slice(0, 6).forEach((pokemonState, pokemonIndex) => {
      this.createSlot(
        pokemonState,
        pokemonIndex,
        trainer.activePokemonIndex,
        replacementPokemonIndexes
      );
    });

    this.refreshInteractionState();
  }

  public setInteractionState(state: BattleClientInteractionState): void {
    this.interactionState = state;
    this.refreshInteractionState();
  }

  public setVisible(visible: boolean): void {
    this.root.hidden = !visible;
  }

  public clear(): void {
    this.slots = [];
    this.grid.replaceChildren();
    this.root.hidden = true;
    this.waitingLabel.hidden = true;
  }

  public destroy(): void {
    this.slots = [];
    this.root.remove();
  }

  public setMode(mode: ModernBattleReplacementPanelMode): void {
    this.mode = mode;

    this.updateBackButton();
    this.refreshInteractionState();
  }

  private createSlot(
    pokemonState: BattlePokemonState,
    pokemonIndex: number,
    activePokemonIndex: number,
    replacementPokemonIndexes: readonly number[]
  ): void {
    const pokemon = pokemonState.pokemon;
    const isActive = pokemonIndex === activePokemonIndex;
    const isFainted = pokemonState.currentHp <= 0;

    const serverAllowsReplacement = replacementPokemonIndexes.includes(pokemonIndex);

    const selectable = serverAllowsReplacement && !isActive && !isFainted;

    const maxHp = getPokemonMaxHp(pokemon);

    const currentHp = Math.max(0, pokemonState.currentHp);

    const hpRatio = maxHp > 0 ? Math.max(0, Math.min(1, currentHp / maxHp)) : 0;

    const asset = getPokemonSpriteAsset(pokemon.speciesId, pokemon.formId);

    const button = document.createElement("button");

    button.type = "button";

    button.className = "battle-modern-replacement-card";

    const spriteWrap = document.createElement("div");

    spriteWrap.className = "battle-modern-replacement-card__sprite-wrap";

    const sprite = document.createElement("img");

    sprite.className = "battle-modern-replacement-card__sprite";

    sprite.src = asset.path;

    sprite.alt = getPokemonDisplayName(pokemon);

    spriteWrap.appendChild(sprite);

    const content = document.createElement("div");

    content.className = "battle-modern-replacement-card__content";

    const top = document.createElement("div");

    top.className = "battle-modern-replacement-card__top";

    const name = document.createElement("div");

    name.className = "battle-modern-replacement-card__name";

    name.textContent = getPokemonDisplayName(pokemon);

    const level = document.createElement("div");

    level.className = "battle-modern-replacement-card__level";

    level.textContent = `Lv. ${pokemon.level}`;

    top.append(name, level);

    const hpRow = document.createElement("div");

    hpRow.className = "battle-modern-replacement-card__hp-row";

    const hpLabel = document.createElement("span");

    hpLabel.textContent = "HP";

    const hpValue = document.createElement("span");

    hpValue.textContent = `${currentHp} / ${maxHp}`;

    hpRow.append(hpLabel, hpValue);

    const hpTrack = document.createElement("div");

    hpTrack.className = "battle-modern-replacement-card__hp-track";

    const hpFill = document.createElement("div");

    hpFill.className = "battle-modern-replacement-card__hp-fill";

    hpFill.style.width = `${hpRatio * 100}%`;

    if (hpRatio > 0.5) {
      hpFill.classList.add("battle-modern-replacement-card__hp-fill--healthy");
    } else if (hpRatio > 0.2) {
      hpFill.classList.add("battle-modern-replacement-card__hp-fill--warning");
    } else {
      hpFill.classList.add("battle-modern-replacement-card__hp-fill--danger");
    }

    hpTrack.appendChild(hpFill);

    const status = document.createElement("div");

    status.className = "battle-modern-replacement-card__status";

    if (isFainted) {
      status.textContent = "FAINTED";
      status.classList.add("battle-modern-replacement-card__status--fainted");
    } else if (isActive) {
      status.textContent = "ACTIVE";
      status.classList.add("battle-modern-replacement-card__status--active");
    } else if (serverAllowsReplacement) {
      status.textContent = "READY";
      status.classList.add("battle-modern-replacement-card__status--ready");
    } else {
      status.textContent = "UNAVAILABLE";
      status.classList.add("battle-modern-replacement-card__status--unavailable");
    }

    content.append(top, hpRow, hpTrack, status);
    button.append(spriteWrap, content);

    button.addEventListener("click", () => {
      const canChoose =
        this.interactionState === "replacement-required" ||
        this.interactionState === "pokemon-selection";

      if (!canChoose || !selectable) {
        return;
      }

      this.onPartyPokemonSelected(pokemonIndex);
    });

    this.grid.appendChild(button);

    this.slots.push({
      button,
      pokemonIndex,
      selectable,
    });
  }

  private refreshInteractionState(): void {
    const canChoose =
      this.interactionState === "replacement-required" ||
      this.interactionState === "pokemon-selection";

    const waiting = this.interactionState === "waiting-for-server";
    this.waitingLabel.hidden = !waiting;
    this.root.classList.toggle("battle-modern-replacement--waiting", waiting);

    for (const slot of this.slots) {
      const enabled = canChoose && slot.selectable;
      slot.button.disabled = !enabled;
      slot.button.classList.toggle("battle-modern-replacement-card--selectable", enabled);
    }

    this.backButton.disabled = !(
      this.mode === "voluntary" && this.interactionState === "pokemon-selection"
    );
  }

  private updateBackButton(): void {
    const isVoluntary = this.mode === "voluntary";
    this.backButton.style.display = isVoluntary ? "block" : "none";
  }
}
