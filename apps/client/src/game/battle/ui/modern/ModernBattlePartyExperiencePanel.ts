import {
  getExperienceForLevel,
  getPokemonSpecies,
  MAX_POKEMON_LEVEL,
} from "@cesar-mmo/shared";

import type { BattlePokemonState } from "@cesar-mmo/shared";

import { getPokemonDisplayName } from "../../../pokemon/pokemon-presentation.utils";
import { getPokemonSpriteAsset } from "../../../pokemon/pokemon-sprite.registry";

interface PartyExperienceRow {
  readonly pokemonInstanceId: string;
  readonly speciesId: number;

  readonly root: HTMLDivElement;
  readonly level: HTMLSpanElement;

  readonly experienceText: HTMLSpanElement;
  readonly experienceFill: HTMLDivElement;

  experienceAnimationTimer?: number;
  experienceAnimationResolve?: () => void;

  levelAnimationTimer?: number;
  levelAnimationResolve?: () => void;
}

export class ModernBattlePartyExperiencePanel {
  private readonly root: HTMLDivElement;
  private readonly list: HTMLDivElement;

  private readonly rows = new Map<string, PartyExperienceRow>();

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");

    this.root.className = "battle-party-experience";

    const title = document.createElement("div");

    title.className = "battle-party-experience__title";

    title.textContent = "PARTY EXP";

    this.list = document.createElement("div");

    this.list.className = "battle-party-experience__list";

    this.root.append(title, this.list);

    parent.appendChild(this.root);

    this.root.hidden = true;
  }

  public renderParty(pokemonStates: readonly BattlePokemonState[]): void {
    this.clearRows();

    for (const state of pokemonStates) {
      const pokemon = state.pokemon;

      const row = document.createElement("div");

      row.className = "battle-party-experience__row";

      if (state.currentHp <= 0) {
        row.classList.add("battle-party-experience__row--fainted");
      }

      if (pokemon.level >= MAX_POKEMON_LEVEL) {
        row.classList.add("battle-party-experience__row--max");
      }

      const sprite = document.createElement("img");

      sprite.className = "battle-party-experience__sprite";

      const spriteAsset = getPokemonSpriteAsset(
        pokemon.speciesId,
        pokemon.formId,
      );

      sprite.src = spriteAsset.path;

      const displayName = getPokemonDisplayName(pokemon);

      sprite.alt = displayName;

      const info = document.createElement("div");

      info.className = "battle-party-experience__info";

      const header = document.createElement("div");

      header.className = "battle-party-experience__header";

      const name = document.createElement("span");

      name.className = "battle-party-experience__name";

      name.textContent = displayName;

      const level = document.createElement("span");

      level.className = "battle-party-experience__level";

      level.textContent = `Lv. ${pokemon.level}`;

      header.append(name, level);

      const progression = document.createElement("div");

      progression.className = "battle-party-experience__progression";

      const experienceTrack = document.createElement("div");

      experienceTrack.className = "battle-party-experience__track";

      const experienceFill = document.createElement("div");

      experienceFill.className = "battle-party-experience__fill";

      experienceTrack.appendChild(experienceFill);

      const experienceText = document.createElement("span");

      experienceText.className = "battle-party-experience__exp";

      if (state.currentHp <= 0) {
        experienceText.textContent = "FAINTED";
      } else if (pokemon.level >= MAX_POKEMON_LEVEL) {
        experienceText.textContent = "MAX";
      } else {
        experienceText.textContent = "EXP";
      }

      progression.append(experienceTrack, experienceText);

      info.append(header, progression);

      row.append(sprite, info);

      this.list.appendChild(row);

      const experienceRatio = this.getExperienceLevelRatio(
        pokemon.speciesId,
        pokemon.experience,
        pokemon.level,
      );

      this.setExperienceRatio(experienceFill, experienceRatio);

      this.rows.set(pokemon.instanceId, {
        pokemonInstanceId: pokemon.instanceId,
        speciesId: pokemon.speciesId,
        root: row,
        level,
        experienceText,
        experienceFill,
      });
    }
  }

  public show(): void {
    this.root.hidden = false;

    this.root.classList.remove("battle-party-experience--visible");

    void this.root.offsetWidth;

    this.root.classList.add("battle-party-experience--visible");
  }

  public hide(): void {
    this.root.hidden = true;

    this.root.classList.remove("battle-party-experience--visible");
  }

  public clear(): void {
    this.hide();
    this.clearRows();
  }

  public destroy(): void {
    this.clear();
    this.root.remove();
  }

  public async animateExperienceGain(
    pokemonInstanceId: string,
    gainedExperience: number,
    previousExperience: number,
    currentExperience: number,
    previousLevel: number,
    currentLevel: number,
    durationMs = 850,
  ): Promise<void> {
    const row = this.rows.get(pokemonInstanceId);

    if (!row) {
      return;
    }

    if (!Number.isInteger(gainedExperience) || gainedExperience <= 0) {
      return;
    }

    if (
      !Number.isInteger(previousExperience) ||
      !Number.isInteger(currentExperience) ||
      previousExperience < 0 ||
      currentExperience < previousExperience
    ) {
      return;
    }

    if (
      !Number.isInteger(previousLevel) ||
      !Number.isInteger(currentLevel) ||
      previousLevel < 1 ||
      currentLevel < previousLevel ||
      currentLevel > MAX_POKEMON_LEVEL
    ) {
      return;
    }

    const species = getPokemonSpecies(row.speciesId);

    if (!species) {
      console.warn("[BattlePartyEXP] species missing", {
        pokemonInstanceId,
        speciesId: row.speciesId,
      });

      return;
    }

    this.show();

    row.root.classList.add("battle-party-experience__row--receiving");

    row.root.classList.remove("battle-party-experience__row--fainted");

    row.experienceText.textContent = `+${gainedExperience} EXP`;

    const prefersReducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    const safeDuration = prefersReducedMotion ? 0 : Math.max(0, durationMs);

    const finalRatio = this.getExperienceLevelRatio(
      row.speciesId,
      currentExperience,
      currentLevel,
    );

    if (safeDuration === 0) {
      row.level.textContent = `Lv. ${currentLevel}`;
      this.setExperienceRatio(row.experienceFill, finalRatio);
      this.updateMaxLevelState(row, currentLevel);
      return;
    }

    let displayedLevel = previousLevel;

    let fromRatio = this.getExperienceLevelRatio(
      row.speciesId,
      previousExperience,
      previousLevel,
    );

    row.level.textContent = `Lv. ${displayedLevel}`;

    this.setExperienceRatio(row.experienceFill, fromRatio);

    while (displayedLevel < currentLevel) {
      await this.animateExperienceRatio(row, fromRatio, 1, safeDuration);

      if (!this.isCurrentRow(pokemonInstanceId, row)) {
        return;
      }

      displayedLevel += 1;

      row.level.textContent = `Lv. ${displayedLevel}`;

      if (displayedLevel >= MAX_POKEMON_LEVEL) {
        this.setExperienceRatio(row.experienceFill, 1);

        fromRatio = 1;

        break;
      }

      /* Nuevo nivel: la barra empieza otra vez desde 0% */
      this.setExperienceRatio(row.experienceFill, 0);

      fromRatio = 0;
    }

    if (currentLevel < MAX_POKEMON_LEVEL && finalRatio > fromRatio) {
      await this.animateExperienceRatio(
        row,
        fromRatio,
        finalRatio,
        safeDuration,
      );
    } else {
      this.setExperienceRatio(row.experienceFill, finalRatio);
    }

    if (!this.isCurrentRow(pokemonInstanceId, row)) {
      return;
    }

    row.level.textContent = `Lv. ${currentLevel}`;

    this.setExperienceRatio(row.experienceFill, finalRatio);
    this.updateMaxLevelState(row, currentLevel);
  }

  public animateLevelUp(
    pokemonInstanceId: string,
    currentLevel: number,
    durationMs = 760,
  ): Promise<void> {
    const row = this.rows.get(pokemonInstanceId);

    if (!row) {
      return Promise.resolve();
    }

    if (
      !Number.isInteger(currentLevel) ||
      currentLevel < 1 ||
      currentLevel > MAX_POKEMON_LEVEL
    ) {
      return Promise.resolve();
    }

    this.show();
    this.finishRowLevelAnimation(row);
    row.level.textContent = `Lv. ${currentLevel}`;
    this.updateMaxLevelState(row, currentLevel);
    const prefersReducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    const safeDuration = prefersReducedMotion ? 0 : Math.max(0, durationMs);

    if (safeDuration === 0) {
      return Promise.resolve();
    }

    row.root.classList.remove("battle-party-experience__row--level-up");
    row.level.classList.remove("battle-party-experience__level--up");

    void row.root.offsetWidth;

    row.root.classList.add("battle-party-experience__row--level-up");
    row.level.classList.add("battle-party-experience__level--up");

    return new Promise<void>((resolve) => {
      row.levelAnimationResolve = resolve;
      row.levelAnimationTimer = window.setTimeout(() => {
        row.levelAnimationTimer = undefined;
        row.levelAnimationResolve = undefined;
        row.root.classList.remove("battle-party-experience__row--level-up");
        row.level.classList.remove("battle-party-experience__level--up");
        resolve();
      }, safeDuration);
    });
  }

  private getExperienceLevelRatio(
    speciesId: number,
    totalExperience: number,
    level: number,
  ): number {
    if (level >= MAX_POKEMON_LEVEL) {
      return 1;
    }

    const species = getPokemonSpecies(speciesId);

    if (!species) {
      return 0;
    }

    const levelFloor = getExperienceForLevel(species.growthRate, level);

    const nextLevelFloor = getExperienceForLevel(species.growthRate, level + 1);

    const levelSpan = nextLevelFloor - levelFloor;

    if (levelSpan <= 0) {
      return 0;
    }

    return Math.max(0, Math.min(1, (totalExperience - levelFloor) / levelSpan));
  }

  private animateExperienceRatio(
    row: PartyExperienceRow,
    fromRatio: number,
    toRatio: number,
    fullBarDurationMs: number,
  ): Promise<void> {
    this.finishRowExperienceAnimation(row);

    const safeFrom = Math.max(0, Math.min(1, fromRatio));

    const safeTo = Math.max(0, Math.min(1, toRatio));

    const distance = Math.abs(safeTo - safeFrom);

    const durationMs = Math.max(
      180,
      Math.min(
        fullBarDurationMs,
        Math.round(fullBarDurationMs * Math.max(0.25, distance)),
      ),
    );

    row.experienceFill.classList.remove(
      "battle-party-experience__fill--gaining",
    );

    this.setExperienceRatio(row.experienceFill, safeFrom);

    row.experienceFill.style.setProperty(
      "--battle-party-exp-duration",
      `${durationMs}ms`,
    );

    void row.experienceFill.offsetWidth;

    row.experienceFill.classList.add("battle-party-experience__fill--gaining");

    this.setExperienceRatio(row.experienceFill, safeTo);

    return new Promise<void>((resolve) => {
      row.experienceAnimationResolve = resolve;
      row.experienceAnimationTimer = window.setTimeout(() => {
        row.experienceAnimationTimer = undefined;
        row.experienceAnimationResolve = undefined;
        row.experienceFill.classList.remove(
          "battle-party-experience__fill--gaining",
        );
        row.experienceFill.style.removeProperty("--battle-party-exp-duration");
        this.setExperienceRatio(row.experienceFill, safeTo);
        resolve();
      }, durationMs);
    });
  }

  private setExperienceRatio(element: HTMLDivElement, ratio: number): void {
    const safeRatio = Math.max(0, Math.min(1, ratio));
    element.style.width = `${safeRatio * 100}%`;
  }

  private updateMaxLevelState(row: PartyExperienceRow, level: number): void {
    const isMax = level >= MAX_POKEMON_LEVEL;

    row.root.classList.toggle("battle-party-experience__row--max", isMax);

    if (isMax) {
      row.experienceText.textContent = "MAX";
      this.setExperienceRatio(row.experienceFill, 1);
    }
  }

  private isCurrentRow(
    pokemonInstanceId: string,
    row: PartyExperienceRow,
  ): boolean {
    return this.rows.get(pokemonInstanceId) === row;
  }

  private finishRowExperienceAnimation(row: PartyExperienceRow): void {
    if (row.experienceAnimationTimer !== undefined) {
      window.clearTimeout(row.experienceAnimationTimer);
      row.experienceAnimationTimer = undefined;
    }

    row.experienceFill.classList.remove(
      "battle-party-experience__fill--gaining",
    );
    row.experienceFill.style.removeProperty("--battle-party-exp-duration");

    const resolve = row.experienceAnimationResolve;
    row.experienceAnimationResolve = undefined;
    resolve?.();
  }

  private finishRowLevelAnimation(row: PartyExperienceRow): void {
    if (row.levelAnimationTimer !== undefined) {
      window.clearTimeout(row.levelAnimationTimer);
      row.levelAnimationTimer = undefined;
    }

    row.root.classList.remove("battle-party-experience__row--level-up");
    row.level.classList.remove("battle-party-experience__level--up");

    const resolve = row.levelAnimationResolve;
    row.levelAnimationResolve = undefined;
    resolve?.();
  }

  private clearRows(): void {
    for (const row of this.rows.values()) {
      this.finishRowExperienceAnimation(row);
      this.finishRowLevelAnimation(row);
    }

    this.rows.clear();
    this.list.replaceChildren();
  }
}
