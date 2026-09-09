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

export type ModernBattleReplacementPanelMode =
  "forced" | "voluntary" | "item-target";

interface ModernBattleReplacementPanelOptions {
  onPartyPokemonSelected: (pokemonIndex: number) => void;
  onBack: () => void;
}

interface ReplacementSlotEntry {
  button: HTMLButtonElement;

  pokemonIndex: number;
  pokemonInstanceId: string;

  maxHp: number;

  selectable: boolean;

  hpValue: HTMLSpanElement;
  hpFill: HTMLDivElement;

  status: HTMLDivElement;
  sprite: HTMLImageElement;
  healFx: HTMLDivElement;
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

  constructor(
    parent: HTMLElement,
    options: ModernBattleReplacementPanelOptions,
  ) {
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
    viewport: ModernBattleReplacementPanelViewport,
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
    selectablePokemonIndexes: readonly number[],
  ): void {
    this.slots = [];

    this.grid.replaceChildren();

    const trainer = battle.participants.find(
      (participant) => participant.type === "trainer",
    );

    if (!trainer) {
      console.warn(
        "[ModernBattleReplacementPanel] trainer participant missing",
        {
          battleId: battle.battleId,
        },
      );

      return;
    }

    trainer.pokemon.slice(0, 6).forEach((pokemonState, pokemonIndex) => {
      this.createSlot(
        pokemonState,
        pokemonIndex,
        trainer.activePokemonIndex,
        selectablePokemonIndexes,
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

    switch (mode) {
      case "forced":
        this.title.textContent = "Choose your next Pokémon";
        this.waitingLabel.textContent = "Switching Pokémon…";
        break;

      case "voluntary":
        this.title.textContent = "Choose a Pokémon";
        this.waitingLabel.textContent = "Switching Pokémon…";
        break;

      case "item-target":
        this.title.textContent = "Use item on which Pokémon?";
        this.waitingLabel.textContent = "Using item…";
        break;
    }

    this.updateBackButton();
    this.refreshInteractionState();
  }

  private createSlot(
    pokemonState: BattlePokemonState,
    pokemonIndex: number,
    activePokemonIndex: number,
    selectablePokemonIndexes: readonly number[],
  ): void {
    const pokemon = pokemonState.pokemon;
    const isActive = pokemonIndex === activePokemonIndex;
    const isFainted = pokemonState.currentHp <= 0;

    const maxHp = getPokemonMaxHp(pokemon);
    const currentHp = Math.max(0, pokemonState.currentHp);
    const isFullHp = currentHp >= maxHp;

    const isAllowed = selectablePokemonIndexes.includes(pokemonIndex);

    const selectable =
      this.mode === "item-target"
        ? isAllowed
        : isAllowed && !isActive && !isFainted;

    const hpRatio = maxHp > 0 ? Math.max(0, Math.min(1, currentHp / maxHp)) : 0;

    const asset = getPokemonSpriteAsset(pokemon.speciesId, pokemon.formId);

    const button = document.createElement("button");

    button.type = "button";
    button.className = "battle-modern-replacement-card";

    if (isFainted) {
      button.classList.add("battle-modern-replacement-card--fainted");
    }

    if (this.mode === "item-target" && isFainted && selectable) {
      button.classList.add("battle-modern-replacement-card--revivable");
    }

    const spriteWrap = document.createElement("div");
    spriteWrap.className = "battle-modern-replacement-card__sprite-wrap";

    const sprite = document.createElement("img");
    sprite.className = "battle-modern-replacement-card__sprite";
    sprite.src = asset.path;
    sprite.alt = getPokemonDisplayName(pokemon);

    const healFx = document.createElement("div");
    healFx.className = "battle-modern-replacement-card__heal-fx";
    healFx.ariaHidden = "true";

    for (let index = 0; index < 6; index += 1) {
      const particle = document.createElement("span");
      particle.className = "battle-modern-replacement-card__heal-particle";
      healFx.appendChild(particle);
    }

    spriteWrap.append(healFx, sprite);

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
    if (this.mode === "item-target") {
      if (isFainted) {
        status.textContent = "FAINTED";
        status.classList.add("battle-modern-replacement-card__status--fainted");
        if (selectable) {
          status.classList.add(
            "battle-modern-replacement-card__status--revivable",
          );
        }
      } else if (selectable) {
        status.textContent = "READY";
        status.classList.add("battle-modern-replacement-card__status--ready");
      } else if (isFullHp) {
        status.textContent = "FULL HP";
        status.classList.add(
          "battle-modern-replacement-card__status--unavailable",
        );
      } else {
        status.textContent = "UNAVAILABLE";
        status.classList.add(
          "battle-modern-replacement-card__status--unavailable",
        );
      }
    } else {
      if (isFainted) {
        status.textContent = "FAINTED";
        status.classList.add("battle-modern-replacement-card__status--fainted");
      } else if (isActive) {
        status.textContent = "ACTIVE";
        status.classList.add("battle-modern-replacement-card__status--active");
      } else if (isAllowed) {
        status.textContent = "READY";
        status.classList.add("battle-modern-replacement-card__status--ready");
      } else {
        status.textContent = "UNAVAILABLE";
        status.classList.add(
          "battle-modern-replacement-card__status--unavailable",
        );
      }
    }

    content.append(top, hpRow, hpTrack, status);
    button.append(spriteWrap, content);

    button.addEventListener("click", () => {
      const canChoose =
        this.interactionState === "replacement-required" ||
        this.interactionState === "pokemon-selection" ||
        this.interactionState === "item-target-selection";

      if (!canChoose || !selectable) {
        return;
      }

      this.onPartyPokemonSelected(pokemonIndex);
    });

    this.grid.appendChild(button);

    this.slots.push({
      button,
      pokemonIndex,
      pokemonInstanceId: pokemon.instanceId,
      maxHp,
      selectable,
      hpValue,
      hpFill,
      status,
      sprite,
      healFx,
    });
  }

  public animatePokemonHp(
    pokemonInstanceId: string,
    previousHp: number,
    currentHp: number,
  ): Promise<void> {
    const slot = this.slots.find(
      (candidate) => candidate.pokemonInstanceId === pokemonInstanceId,
    );

    if (!slot || this.root.hidden) {
      return Promise.resolve();
    }

    const fromHp = Math.max(0, Math.min(slot.maxHp, previousHp));

    const toHp = Math.max(0, Math.min(slot.maxHp, currentHp));

    if (fromHp === toHp) {
      return Promise.resolve();
    }

    const isRevive = fromHp === 0 && toHp > 0;

    const prefersReducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    const durationMs = prefersReducedMotion ? 0 : 760;

    /*
     * Heal visual state.
     *
     * Green:
     * Potion / Super / Hyper / Max Potion
     *
     * Gold:
     * Revive / Max Revive
     */
    slot.button.classList.add("battle-modern-replacement-card--healing");

    if (isRevive) {
      slot.button.classList.add("battle-modern-replacement-card--reviving");
    }

    /* Restart particles/ring even when using multiple items consecutively */
    slot.healFx.classList.remove(
      "battle-modern-replacement-card__heal-fx--active",
      "battle-modern-replacement-card__heal-fx--heal",
      "battle-modern-replacement-card__heal-fx--revive",
    );

    void slot.healFx.offsetWidth;

    slot.healFx.classList.add(
      "battle-modern-replacement-card__heal-fx--active",
      isRevive
        ? "battle-modern-replacement-card__heal-fx--revive"
        : "battle-modern-replacement-card__heal-fx--heal",
    );

    const finishPresentation = (): void => {
      this.updateSlotHpVisual(slot, toHp);

      slot.healFx.classList.remove(
        "battle-modern-replacement-card__heal-fx--active",
        "battle-modern-replacement-card__heal-fx--heal",
        "battle-modern-replacement-card__heal-fx--revive",
      );

      slot.button.classList.remove(
        "battle-modern-replacement-card--healing",
        "battle-modern-replacement-card--reviving",
      );

      /*
       * Sólo después de terminar la animación
       * consideramos visualmente revivido al Pokémon.
       */
      if (isRevive) {
        slot.button.classList.remove(
          "battle-modern-replacement-card--fainted",
          "battle-modern-replacement-card--revivable",
        );
        /*
         * FNT desaparece.
         * No mostramos REVIVED porque queremos que
         * la recuperación se comunique visualmente.
         */
        slot.status.textContent = "";
        slot.status.className = "battle-modern-replacement-card__status";

        slot.status.hidden = true;
      }
    };

    if (durationMs === 0) {
      finishPresentation();
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const startedAt = performance.now();

      const step = (timestamp: number): void => {
        const elapsed = timestamp - startedAt;
        const progress = Math.min(1, elapsed / durationMs);

        /* Un easing suave queda mejor para curación: acelera al comienzo y termina lentamente */
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        const visualHp = Math.round(fromHp + (toHp - fromHp) * easedProgress);
        this.updateSlotHpVisual(slot, visualHp);

        if (progress < 1) {
          requestAnimationFrame(step);
          return;
        }

        finishPresentation();
        resolve();
      };

      requestAnimationFrame(step);
    });
  }

  private updateSlotHpVisual(
    slot: ReplacementSlotEntry,
    currentHp: number,
  ): void {
    const clampedHp = Math.max(0, Math.min(slot.maxHp, currentHp));
    const hpRatio = slot.maxHp > 0 ? clampedHp / slot.maxHp : 0;

    slot.hpValue.textContent = `${clampedHp} / ${slot.maxHp}`;
    slot.hpFill.style.width = `${hpRatio * 100}%`;
    slot.hpFill.classList.remove(
      "battle-modern-replacement-card__hp-fill--healthy",
      "battle-modern-replacement-card__hp-fill--warning",
      "battle-modern-replacement-card__hp-fill--danger",
    );

    if (hpRatio > 0.5) {
      slot.hpFill.classList.add(
        "battle-modern-replacement-card__hp-fill--healthy",
      );
    } else if (hpRatio > 0.2) {
      slot.hpFill.classList.add(
        "battle-modern-replacement-card__hp-fill--warning",
      );
    } else {
      slot.hpFill.classList.add(
        "battle-modern-replacement-card__hp-fill--danger",
      );
    }
  }

  private refreshInteractionState(): void {
    const canChoose =
      this.interactionState === "replacement-required" ||
      this.interactionState === "pokemon-selection" ||
      this.interactionState === "item-target-selection";

    const waiting = this.interactionState === "waiting-for-server";
    this.waitingLabel.hidden = !waiting;
    this.root.classList.toggle("battle-modern-replacement--waiting", waiting);

    for (const slot of this.slots) {
      const enabled = canChoose && slot.selectable;
      slot.button.disabled = !enabled;
      slot.button.classList.toggle(
        "battle-modern-replacement-card--selectable",
        enabled,
      );
    }

    const backEnabled =
      (this.mode === "voluntary" &&
        this.interactionState === "pokemon-selection") ||
      (this.mode === "item-target" &&
        this.interactionState === "item-target-selection");

    this.backButton.disabled = !backEnabled;
  }

  private updateBackButton(): void {
    const visible = this.mode === "voluntary" || this.mode === "item-target";

    this.backButton.style.display = visible ? "block" : "none";
  }
}
