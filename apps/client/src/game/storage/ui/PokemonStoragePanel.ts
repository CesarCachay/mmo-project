import {
  MAX_POKEMON_PARTY_SIZE,
  type PokemonInstance,
  type PokemonStorageStatePayload,
} from "@cesar-mmo/shared";

import {
  getPokemonDisplayName,
  getPokemonMaxHp,
} from "../../pokemon/pokemon-presentation.utils";

import { getPokemonSpriteAsset } from "../../pokemon/pokemon-sprite.registry";

export interface PokemonStoragePanelOptions {
  onWithdraw: (pokemonInstanceId: string) => void;
  onDeposit: (pokemonInstanceId: string) => void;
  onSwap: (storedPokemonInstanceId: string, partyPokemonInstanceId: string) => void;
  onClose: () => void;
}

type PokemonStorageSource = "party" | "storage";

export class PokemonStoragePanel {
  private readonly root: HTMLDivElement;
  private readonly partyGrid: HTMLDivElement;
  private readonly storageGrid: HTMLDivElement;
  private readonly partyCount: HTMLSpanElement;
  private readonly storageCount: HTMLSpanElement;
  private readonly status: HTMLDivElement;
  private readonly error: HTMLDivElement;
  private readonly withdrawButton: HTMLButtonElement;
  private readonly depositButton: HTMLButtonElement;
  private readonly swapButton: HTMLButtonElement;
  private readonly closeButton: HTMLButtonElement;

  private state?: PokemonStorageStatePayload;
  private selectedPartyPokemonInstanceId?: string;
  private selectedStoragePokemonInstanceId?: string;

  private pending = false;

  private readonly options: PokemonStoragePanelOptions;

  constructor(options: PokemonStoragePanelOptions) {
    this.options = options;
    const app = document.getElementById("app");
    if (!app) {
      throw new Error('Pokémon Storage UI requires "#app" root element');
    }

    this.root = document.createElement("div");
    this.root.className = "pokemon-storage-ui";
    this.root.hidden = true;
    this.root.setAttribute("data-pokemon-storage-ui", "true");

    const shell = document.createElement("div");
    shell.className = "pokemon-storage-ui__shell";

    /*
     * HEADER
     */
    const header = document.createElement("header");
    header.className = "pokemon-storage-ui__header";

    const heading = document.createElement("div");
    heading.className = "pokemon-storage-ui__heading";

    const title = document.createElement("div");
    title.className = "pokemon-storage-ui__title";
    title.textContent = "POKÉMON STORAGE SYSTEM";

    const subtitle = document.createElement("div");
    subtitle.className = "pokemon-storage-ui__subtitle";
    subtitle.textContent = "Organize your Party and stored Pokémon.";

    heading.append(title, subtitle);
    header.appendChild(heading);

    /* CONTENT */
    const content = document.createElement("div");

    content.className = "pokemon-storage-ui__content";

    /* PARTY */
    const partySection = document.createElement("section");

    partySection.className = [
      "pokemon-storage-ui__section",
      "pokemon-storage-ui__section--party",
    ].join(" ");

    const partyHeader = document.createElement("div");
    partyHeader.className = "pokemon-storage-ui__section-header";

    const partyTitle = document.createElement("span");
    partyTitle.textContent = "PARTY";

    this.partyCount = document.createElement("span");
    this.partyCount.className = "pokemon-storage-ui__count";

    partyHeader.append(partyTitle, this.partyCount);

    this.partyGrid = document.createElement("div");
    this.partyGrid.className = "pokemon-storage-ui__party-grid";

    partySection.append(partyHeader, this.partyGrid);

    /* STORAGE */
    const storageSection = document.createElement("section");

    storageSection.className = [
      "pokemon-storage-ui__section",
      "pokemon-storage-ui__section--storage",
    ].join(" ");

    const storageHeader = document.createElement("div");
    storageHeader.className = "pokemon-storage-ui__section-header";

    const storageTitle = document.createElement("span");
    storageTitle.textContent = "STORAGE";

    this.storageCount = document.createElement("span");
    this.storageCount.className = "pokemon-storage-ui__count";

    storageHeader.append(storageTitle, this.storageCount);

    this.storageGrid = document.createElement("div");
    this.storageGrid.className = "pokemon-storage-ui__storage-grid";

    storageSection.append(storageHeader, this.storageGrid);
    content.append(partySection, storageSection);

    /* FEEDBACK */
    const feedback = document.createElement("div");
    feedback.className = "pokemon-storage-ui__feedback";
    this.status = document.createElement("div");
    this.status.className = "pokemon-storage-ui__status";
    this.error = document.createElement("div");
    this.error.className = "pokemon-storage-ui__error";
    feedback.append(this.status, this.error);

    /* ACTIONS */
    const actions = document.createElement("footer");
    actions.className = "pokemon-storage-ui__actions";

    this.withdrawButton = this.createActionButton("WITHDRAW", () =>
      this.handleWithdraw()
    );

    this.depositButton = this.createActionButton("DEPOSIT", () => this.handleDeposit());
    this.swapButton = this.createActionButton("SWAP", () => this.handleSwap());

    this.closeButton = this.createActionButton("CLOSE", () => {
      this.options.onClose();
    });

    this.closeButton.classList.add("pokemon-storage-ui__action--close");

    actions.append(
      this.withdrawButton,
      this.depositButton,
      this.swapButton,
      this.closeButton
    );

    shell.append(header, content, feedback, actions);
    this.root.appendChild(shell);
    app.appendChild(this.root);
    this.updateActions();
  }

  public get isVisible(): boolean {
    return !this.root.hidden;
  }

  public show(): void {
    this.root.hidden = false;
  }

  public hide(): void {
    this.root.hidden = true;
    this.pending = false;
    this.selectedPartyPokemonInstanceId = undefined;
    this.selectedStoragePokemonInstanceId = undefined;
    this.status.textContent = "";
    this.error.textContent = "";
    this.updateActions();
  }

  public destroy(): void {
    this.root.remove();
  }

  public setState(state: PokemonStorageStatePayload): void {
    this.state = state;
    this.selectedPartyPokemonInstanceId = undefined;
    this.selectedStoragePokemonInstanceId = undefined;
    this.pending = false;
    this.status.textContent = "";
    this.error.textContent = "";
    this.render();
  }

  public setPending(pending: boolean): void {
    this.pending = pending;
    this.status.textContent = pending ? "Updating storage..." : "";
    this.updateInteractiveState();
  }

  public setError(message?: string): void {
    this.error.textContent = message ?? "";
  }

  private render(): void {
    const state = this.state;

    if (!state) {
      this.partyGrid.replaceChildren();
      this.storageGrid.replaceChildren();
      this.partyCount.textContent = "0";
      this.storageCount.textContent = "0";
      this.updateActions();
      return;
    }

    this.partyCount.textContent = `${state.party.pokemon.length}/${MAX_POKEMON_PARTY_SIZE}`;
    this.storageCount.textContent = String(state.storage.pokemon.length);
    this.renderPokemonCollection(this.partyGrid, state.party.pokemon, "party");
    this.renderPokemonCollection(this.storageGrid, state.storage.pokemon, "storage");
    this.updateActions();
  }

  private renderPokemonCollection(
    container: HTMLDivElement,
    pokemon: readonly PokemonInstance[],
    source: PokemonStorageSource
  ): void {
    container.replaceChildren();

    if (pokemon.length === 0) {
      const empty = document.createElement("div");
      empty.className = "pokemon-storage-ui__empty";
      empty.textContent =
        source === "party" ? "No Pokémon in Party." : "Storage is empty.";

      container.appendChild(empty);
      return;
    }

    pokemon.forEach((instance) => {
      container.appendChild(this.createPokemonCard(instance, source));
    });
  }

  private createPokemonCard(
    pokemon: PokemonInstance,
    source: PokemonStorageSource
  ): HTMLButtonElement {
    const card = document.createElement("button");

    card.type = "button";
    card.className = "pokemon-storage-card";

    const selected =
      source === "party"
        ? this.selectedPartyPokemonInstanceId === pokemon.instanceId
        : this.selectedStoragePokemonInstanceId === pokemon.instanceId;

    if (selected) {
      card.classList.add("pokemon-storage-card--selected");
    }

    const asset = getPokemonSpriteAsset(pokemon.speciesId, pokemon.formId);
    const sprite = document.createElement("img");

    sprite.className = "pokemon-storage-card__sprite";
    sprite.src = asset.path;
    sprite.alt = getPokemonDisplayName(pokemon);

    const info = document.createElement("div");
    info.className = "pokemon-storage-card__info";

    const top = document.createElement("div");
    top.className = "pokemon-storage-card__top";

    const name = document.createElement("span");
    name.className = "pokemon-storage-card__name";
    name.textContent = getPokemonDisplayName(pokemon);

    const level = document.createElement("span");

    level.className = "pokemon-storage-card__level";
    level.textContent = `Lv. ${pokemon.level}`;

    top.append(name, level);

    const maxHp = getPokemonMaxHp(pokemon);
    const currentHp = Math.max(0, pokemon.currentHp);

    const hpRatio = maxHp > 0 ? Math.max(0, Math.min(1, currentHp / maxHp)) : 0;
    const hpText = document.createElement("div");

    hpText.className = "pokemon-storage-card__hp-text";
    hpText.textContent = `HP ${currentHp}/${maxHp}`;

    const hpTrack = document.createElement("div");
    hpTrack.className = "pokemon-storage-card__hp-track";

    const hpFill = document.createElement("div");
    hpFill.className = "pokemon-storage-card__hp-fill";
    hpFill.style.width = `${hpRatio * 100}%`;

    if (hpRatio > 0.5) {
      hpFill.classList.add("pokemon-storage-card__hp-fill--healthy");
    } else if (hpRatio > 0.2) {
      hpFill.classList.add("pokemon-storage-card__hp-fill--warning");
    } else {
      hpFill.classList.add("pokemon-storage-card__hp-fill--danger");
    }

    hpTrack.appendChild(hpFill);

    info.append(top, hpText, hpTrack);

    card.append(sprite, info);
    card.disabled = this.pending;
    card.addEventListener("click", () => {
      if (this.pending) {
        return;
      }

      this.error.textContent = "";

      if (source === "party") {
        this.selectedPartyPokemonInstanceId =
          this.selectedPartyPokemonInstanceId === pokemon.instanceId
            ? undefined
            : pokemon.instanceId;
      } else {
        this.selectedStoragePokemonInstanceId =
          this.selectedStoragePokemonInstanceId === pokemon.instanceId
            ? undefined
            : pokemon.instanceId;
      }

      this.render();
    });

    return card;
  }

  private handleWithdraw(): void {
    const pokemonInstanceId = this.selectedStoragePokemonInstanceId;

    if (!pokemonInstanceId) {
      return;
    }

    this.setPending(true);
    this.options.onWithdraw(pokemonInstanceId);
  }

  private handleDeposit(): void {
    const pokemonInstanceId = this.selectedPartyPokemonInstanceId;

    if (!pokemonInstanceId) {
      return;
    }

    this.setPending(true);
    this.options.onDeposit(pokemonInstanceId);
  }

  private handleSwap(): void {
    const storedPokemonInstanceId = this.selectedStoragePokemonInstanceId;
    const partyPokemonInstanceId = this.selectedPartyPokemonInstanceId;

    if (!storedPokemonInstanceId || !partyPokemonInstanceId) {
      return;
    }

    this.setPending(true);
    this.options.onSwap(storedPokemonInstanceId, partyPokemonInstanceId);
  }

  private createActionButton(label: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "pokemon-storage-ui__action";
    button.textContent = label;
    button.addEventListener("click", onClick);

    return button;
  }

  private updateInteractiveState(): void {
    this.root
      .querySelectorAll<HTMLButtonElement>(".pokemon-storage-card")
      .forEach((button) => {
        button.disabled = this.pending;
      });

    this.updateActions();
  }

  private updateActions(): void {
    const state = this.state;
    const partySize = state?.party.pokemon.length ?? 0;

    this.withdrawButton.disabled =
      this.pending ||
      !this.selectedStoragePokemonInstanceId ||
      partySize >= MAX_POKEMON_PARTY_SIZE;

    this.depositButton.disabled =
      this.pending || !this.selectedPartyPokemonInstanceId || partySize <= 1;

    this.swapButton.disabled =
      this.pending ||
      !this.selectedPartyPokemonInstanceId ||
      !this.selectedStoragePokemonInstanceId;

    /*
     * Evitamos cerrar durante una mutación
     * para que un STORAGE_STATE tardío no
     * vuelva a abrir visualmente el panel.
     */
    this.closeButton.disabled = this.pending;
  }
}
