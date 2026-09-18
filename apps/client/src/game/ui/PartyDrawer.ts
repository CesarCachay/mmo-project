import type { PokemonInstance } from "@cesar-mmo/shared";

import {
  getPokemonDisplayName,
  getPokemonMaxHp,
} from "../pokemon/pokemon-presentation.utils";

import { getPokemonSpriteAsset } from "../pokemon/pokemon-sprite.registry";

import "./party-drawer.css";

const DRAWER_HIDE_DURATION_MS = 170;
const HP_WARNING_RATIO = 0.5;
const HP_DANGER_RATIO = 0.2;

export interface PartyDrawerOptions {
  readonly onPokemonSelected?: (pokemon: PokemonInstance, index: number) => void;
  readonly onChangeRequested?: (pokemon: PokemonInstance, index: number) => void;
  readonly onReorderRequested?: () => void;
  readonly onCloseRequested?: () => void;
}

export interface PartyDrawerReorderState {
  readonly active: boolean;
  readonly sourcePokemonInstanceId: string | undefined;
  readonly pending: boolean;
}

interface PartySlotPresentation {
  readonly root: HTMLDivElement;
  readonly sprite: HTMLImageElement;
  readonly hpText: HTMLSpanElement;
  readonly hpFill: HTMLSpanElement;
  readonly status: HTMLSpanElement;
  readonly maxHp: number;
}

export class PartyDrawer {
  private readonly root: HTMLElement;
  private readonly title: HTMLHeadingElement;
  private readonly subtitle: HTMLSpanElement;
  private readonly reorderButton: HTMLButtonElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly list: HTMLDivElement;
  private readonly footer: HTMLDivElement;

  private readonly onPokemonSelected?: PartyDrawerOptions["onPokemonSelected"];
  private readonly onChangeRequested?: PartyDrawerOptions["onChangeRequested"];
  private readonly onReorderRequested?: PartyDrawerOptions["onReorderRequested"];
  private readonly onCloseRequested?: PartyDrawerOptions["onCloseRequested"];

  private party: readonly PokemonInstance[] = [];
  private hasPokemon = false;
  private visible = false;

  private targetSelectionMode = false;

  private reorderMode = false;
  private reorderSourcePokemonInstanceId: string | undefined;
  private reorderPending = false;

  private contextMenuPokemonInstanceId: string | undefined;

  private readonly slotPresentations = new Map<string, PartySlotPresentation>();

  private hideTimer?: number;
  private destroyed = false;

  constructor(options: PartyDrawerOptions = {}) {
    const app = document.getElementById("app");

    if (!(app instanceof HTMLDivElement)) {
      throw new Error('PartyDrawer requires "#app"');
    }

    this.onPokemonSelected = options.onPokemonSelected;
    this.onChangeRequested = options.onChangeRequested;
    this.onReorderRequested = options.onReorderRequested;
    this.onCloseRequested = options.onCloseRequested;

    this.root = document.createElement("aside");
    this.root.className = "party-drawer";
    this.root.hidden = true;
    this.root.setAttribute("aria-hidden", "true");
    this.root.setAttribute("aria-label", "Equipo Pokémon");

    const header = document.createElement("header");
    header.className = "party-drawer__header";

    const heading = document.createElement("div");
    heading.className = "party-drawer__heading";

    this.subtitle = document.createElement("span");
    this.subtitle.className = "party-drawer__eyebrow";
    this.subtitle.textContent = "Trainer";

    this.title = document.createElement("h2");
    this.title.className = "party-drawer__title";
    this.title.textContent = "Equipo Pokémon";

    heading.append(this.subtitle, this.title);

    const headerActions = document.createElement("div");
    headerActions.className = "party-drawer__header-actions";

    this.reorderButton = document.createElement("button");
    this.reorderButton.type = "button";
    this.reorderButton.className = "party-drawer__reorder";
    this.reorderButton.textContent = "Ordenar";
    this.reorderButton.setAttribute("aria-label", "Ordenar equipo Pokémon");

    this.reorderButton.addEventListener("click", () => {
      if (this.reorderPending) {
        return;
      }

      if (this.reorderMode) {
        this.onCloseRequested?.();
      } else {
        this.onReorderRequested?.();
      }

      this.reorderButton.blur();
    });

    this.closeButton = document.createElement("button");
    this.closeButton.type = "button";
    this.closeButton.className = "party-drawer__close";
    this.closeButton.textContent = "×";
    this.closeButton.setAttribute("aria-label", "Cerrar Party");

    this.closeButton.addEventListener("click", () => {
      this.onCloseRequested?.();
      this.closeButton.blur();
    });

    headerActions.append(this.reorderButton, this.closeButton);
    header.append(heading, headerActions);

    this.list = document.createElement("div");
    this.list.className = "party-drawer__list";

    this.footer = document.createElement("div");
    this.footer.className = "party-drawer__footer";

    this.root.append(header, this.list, this.footer);
    app.append(this.root);
  }

  public setParty(pokemon: readonly PokemonInstance[]): void {
    this.party = pokemon;

    if (
      this.contextMenuPokemonInstanceId &&
      !pokemon.some(
        (instance) => instance.instanceId === this.contextMenuPokemonInstanceId
      )
    ) {
      this.contextMenuPokemonInstanceId = undefined;
    }

    this.hasPokemon = pokemon.length > 0;

    if (!this.hasPokemon) {
      this.hide();
    }

    this.render();
  }

  public hide(): void {
    const hadContextMenu = this.contextMenuPokemonInstanceId !== undefined;

    this.contextMenuPokemonInstanceId = undefined;

    if (hadContextMenu) {
      this.render();
    }

    if (!this.visible) {
      return;
    }

    this.visible = false;

    this.root.classList.remove("party-drawer--open");
    this.root.setAttribute("aria-hidden", "true");

    if (this.hideTimer !== undefined) {
      window.clearTimeout(this.hideTimer);
    }

    this.hideTimer = window.setTimeout(() => {
      this.hideTimer = undefined;

      if (!this.visible) {
        this.root.hidden = true;
      }
    }, DRAWER_HIDE_DURATION_MS);
  }

  public show(): void {
    if (!this.hasPokemon || this.destroyed) {
      return;
    }

    if (this.hideTimer !== undefined) {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = undefined;
    }

    this.visible = true;
    this.root.hidden = false;
    this.root.setAttribute("aria-hidden", "false");

    window.requestAnimationFrame(() => {
      if (!this.visible || this.destroyed) {
        return;
      }

      this.root.classList.add("party-drawer--open");
    });
  }

  public toggle(): void {
    if (!this.hasPokemon) {
      return;
    }

    if (this.visible) {
      this.hide();
      return;
    }

    this.show();
  }

  public isVisible(): boolean {
    return this.visible;
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

    this.render();
  }

  public isTargetSelectionMode(): boolean {
    return this.targetSelectionMode;
  }

  public setReorderState(state: PartyDrawerReorderState): void {
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

    this.render();
  }

  public isReorderMode(): boolean {
    return this.reorderMode;
  }

  public animateHpRestore(
    pokemonInstanceId: string,
    previousHp: number,
    currentHp: number,
    isRevive: boolean,
    durationMs = 760
  ): Promise<void> {
    const slot = this.slotPresentations.get(pokemonInstanceId);

    if (!slot || !this.visible) {
      return Promise.resolve();
    }

    const fromHp = this.clampHp(previousHp, slot.maxHp);
    const toHp = this.clampHp(currentHp, slot.maxHp);

    if (toHp <= fromHp) {
      return Promise.resolve();
    }

    const prefersReducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    const safeDuration = prefersReducedMotion ? 0 : Math.max(0, durationMs);

    slot.root.classList.add("party-drawer__pokemon--healing");

    if (isRevive) {
      slot.root.classList.add("party-drawer__pokemon--reviving");
    }

    this.updateSlotHpVisual(slot, fromHp);

    if (safeDuration === 0) {
      this.updateSlotHpVisual(slot, toHp);
      this.finishHpAnimation(slot);

      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const startedAt = performance.now();

      const step = (timestamp: number) => {
        if (this.destroyed || !this.root.isConnected) {
          resolve();
          return;
        }

        const elapsed = timestamp - startedAt;
        const progress = Math.min(1, elapsed / safeDuration);

        /*
         * Cubic.Out:
         * progreso perceptualmente rápido al inicio y suave al final.
         */
        const eased = 1 - Math.pow(1 - progress, 3);

        const hp = Math.round(fromHp + (toHp - fromHp) * eased);

        this.updateSlotHpVisual(slot, hp);

        if (progress < 1) {
          window.requestAnimationFrame(step);
          return;
        }

        this.updateSlotHpVisual(slot, toHp);
        this.finishHpAnimation(slot);
        resolve();
      };

      window.requestAnimationFrame(step);
    });
  }

  public destroy(): void {
    this.destroyed = true;
    this.visible = false;

    if (this.hideTimer !== undefined) {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = undefined;
    }

    this.slotPresentations.clear();
    this.root.remove();
  }

  private render(): void {
    if (this.destroyed) {
      return;
    }

    this.slotPresentations.clear();
    this.list.replaceChildren();

    this.title.textContent = this.getTitleText();
    this.subtitle.textContent = this.getSubtitleText();
    this.footer.textContent = this.getFooterText();

    this.reorderButton.disabled = this.reorderPending;
    this.reorderButton.hidden =
      this.targetSelectionMode || !this.onReorderRequested;
    this.reorderButton.textContent = this.reorderMode ? "Cancelar" : "Ordenar";
    this.reorderButton.setAttribute(
      "aria-label",
      this.reorderMode ? "Cancelar cambio de orden" : "Ordenar equipo Pokémon"
    );

    this.closeButton.disabled = this.reorderPending;
    this.closeButton.setAttribute(
      "aria-label",
      this.targetSelectionMode || this.reorderMode ? "Volver" : "Cerrar Party"
    );

    this.root.classList.toggle(
      "party-drawer--special-mode",
      this.targetSelectionMode || this.reorderMode
    );

    this.root.classList.toggle("party-drawer--pending", this.reorderPending);

    if (!this.hasPokemon) {
      const empty = document.createElement("div");
      empty.className = "party-drawer__empty";
      empty.textContent = "No tienes Pokémon en el equipo.";

      this.list.append(empty);
      return;
    }

    this.party.forEach((pokemon, index) => {
      this.list.append(this.createPokemonSlot(pokemon, index));
    });
  }

  private createPokemonSlot(pokemon: PokemonInstance, index: number): HTMLDivElement {
    const maxHp = getPokemonMaxHp(pokemon);
    const safeCurrentHp = this.clampHp(pokemon.currentHp, maxHp);

    const displayName = getPokemonDisplayName(pokemon);
    const asset = getPokemonSpriteAsset(pokemon.speciesId, pokemon.formId);

    const isFainted = safeCurrentHp <= 0;

    const isReorderSource =
      this.reorderMode && this.reorderSourcePokemonInstanceId === pokemon.instanceId;

    const isContextSelected =
      !this.targetSelectionMode &&
      !this.reorderMode &&
      this.contextMenuPokemonInstanceId === pokemon.instanceId;

    const slot = document.createElement("div");
    slot.className = "party-drawer__pokemon";

    slot.classList.toggle("party-drawer__pokemon--fainted", isFainted);

    slot.classList.toggle("party-drawer__pokemon--source", isReorderSource);

    slot.classList.toggle("party-drawer__pokemon--selected", isContextSelected);

    slot.classList.toggle("party-drawer__pokemon--pending", this.reorderPending);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "party-drawer__pokemon-button";
    button.disabled = this.reorderPending;

    const spriteFrame = document.createElement("span");
    spriteFrame.className = "party-drawer__sprite-frame";

    const sprite = document.createElement("img");
    sprite.className = "party-drawer__sprite";
    sprite.src = asset.path;
    sprite.alt = displayName;
    sprite.draggable = false;

    spriteFrame.append(sprite);

    const content = document.createElement("span");
    content.className = "party-drawer__pokemon-content";

    const heading = document.createElement("span");
    heading.className = "party-drawer__pokemon-heading";

    const name = document.createElement("span");
    name.className = "party-drawer__pokemon-name";
    name.textContent = displayName;
    name.title = displayName;

    const level = document.createElement("span");
    level.className = "party-drawer__pokemon-level";
    level.textContent = `Lv. ${pokemon.level}`;

    heading.append(name, level);

    const hpHeader = document.createElement("span");
    hpHeader.className = "party-drawer__hp-header";

    const hpLabel = document.createElement("span");
    hpLabel.className = "party-drawer__hp-label";
    hpLabel.textContent = "HP";

    const hpText = document.createElement("span");
    hpText.className = "party-drawer__hp-text";

    hpHeader.append(hpLabel, hpText);

    const hpTrack = document.createElement("span");
    hpTrack.className = "party-drawer__hp-track";

    const hpFill = document.createElement("span");
    hpFill.className = "party-drawer__hp-fill";

    hpTrack.append(hpFill);

    const statusRow = document.createElement("span");
    statusRow.className = "party-drawer__status-row";

    const position = document.createElement("span");
    position.className = "party-drawer__position";

    if (index === 0) {
      position.textContent = "PRIMERO";
      position.classList.add("party-drawer__position--lead");
    } else {
      position.textContent = `POS. ${index + 1}`;
    }

    const status = document.createElement("span");
    status.className = "party-drawer__status";

    statusRow.append(position, status);

    content.append(heading, hpHeader, hpTrack, statusRow);

    button.append(spriteFrame, content);

    button.addEventListener("click", () => {
      if (this.reorderPending) {
        return;
      }

      if (this.targetSelectionMode || this.reorderMode) {
        this.onPokemonSelected?.(pokemon, index);

        return;
      }

      this.contextMenuPokemonInstanceId =
        this.contextMenuPokemonInstanceId === pokemon.instanceId
          ? undefined
          : pokemon.instanceId;

      this.render();
    });

    slot.append(button);

    if (isContextSelected) {
      slot.append(this.createPokemonActions(pokemon, index));
    }

    const presentation: PartySlotPresentation = {
      root: slot,
      sprite,
      hpText,
      hpFill,
      status,
      maxHp,
    };

    this.slotPresentations.set(pokemon.instanceId, presentation);

    this.updateSlotHpVisual(presentation, safeCurrentHp);

    return slot;
  }

  private createPokemonActions(pokemon: PokemonInstance, index: number): HTMLDivElement {
    const actions = document.createElement("div");
    actions.className = "party-drawer__actions";

    const hint = document.createElement("span");
    hint.className = "party-drawer__actions-label";
    hint.textContent = "Acciones";

    const actionButtons = document.createElement("div");

    actionButtons.className = "party-drawer__actions-buttons";

    const changeButton = document.createElement("button");

    changeButton.type = "button";
    changeButton.className = "party-drawer__action party-drawer__action--primary";
    changeButton.textContent = "Cambiar posición";
    changeButton.disabled = !this.onChangeRequested;

    changeButton.addEventListener("click", () => {
      this.onChangeRequested?.(pokemon, index);
    });

    const closeButton = document.createElement("button");

    closeButton.type = "button";
    closeButton.className = "party-drawer__action";
    closeButton.textContent = "Cerrar";

    closeButton.addEventListener("click", () => {
      this.contextMenuPokemonInstanceId = undefined;

      this.render();
    });

    actionButtons.append(changeButton, closeButton);

    actions.append(hint, actionButtons);

    return actions;
  }

  private updateSlotHpVisual(slot: PartySlotPresentation, currentHp: number): void {
    const safeHp = this.clampHp(currentHp, slot.maxHp);

    const hpRatio = slot.maxHp > 0 ? safeHp / slot.maxHp : 0;

    slot.hpText.textContent = `${safeHp} / ${slot.maxHp}`;

    slot.hpFill.style.width = `${hpRatio * 100}%`;

    slot.hpFill.classList.remove(
      "party-drawer__hp-fill--healthy",
      "party-drawer__hp-fill--warning",
      "party-drawer__hp-fill--danger"
    );

    if (hpRatio > HP_WARNING_RATIO) {
      slot.hpFill.classList.add("party-drawer__hp-fill--healthy");
    } else if (hpRatio > HP_DANGER_RATIO) {
      slot.hpFill.classList.add("party-drawer__hp-fill--warning");
    } else {
      slot.hpFill.classList.add("party-drawer__hp-fill--danger");
    }

    const isFainted = safeHp <= 0;

    slot.root.classList.toggle("party-drawer__pokemon--fainted", isFainted);

    slot.sprite.classList.toggle("party-drawer__sprite--fainted", isFainted);

    slot.status.textContent = isFainted ? "DEBILITADO" : "";

    slot.status.hidden = !isFainted;
  }

  private finishHpAnimation(slot: PartySlotPresentation): void {
    slot.root.classList.remove(
      "party-drawer__pokemon--healing",
      "party-drawer__pokemon--reviving"
    );
  }

  private clampHp(value: number, maxHp: number): number {
    return Math.max(0, Math.min(Math.round(value), maxHp));
  }

  private getTitleText(): string {
    if (this.targetSelectionMode) {
      return "Elige un Pokémon";
    }

    if (this.reorderPending) {
      return "Guardando orden...";
    }

    if (this.reorderMode) {
      return this.reorderSourcePokemonInstanceId
        ? "Elige destino"
        : "Elige Pokémon";
    }

    return "Equipo Pokémon";
  }

  private getSubtitleText(): string {
    if (this.targetSelectionMode) {
      return "Usar objeto";
    }

    if (this.reorderMode) {
      return this.reorderSourcePokemonInstanceId
        ? "Cambiar posición"
        : "Ordenar equipo";
    }

    return `${this.party.length} / 6`;
  }

  private getFooterText(): string {
    if (this.targetSelectionMode) {
      return "[ESC] Volver al Bag";
    }

    if (this.reorderPending) {
      return "Guardando el nuevo orden...";
    }

    if (this.reorderMode) {
      return this.reorderSourcePokemonInstanceId
        ? "Toca la nueva posición · [ESC] Cancelar"
        : "Toca el Pokémon que quieres mover · [ESC] Cancelar";
    }

    return "[P] Cerrar  ·  [I] Bag";
  }
}
