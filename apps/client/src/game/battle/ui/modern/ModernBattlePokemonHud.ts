import {
  getExperienceForLevel,
  getPokemonSpecies,
  MAX_POKEMON_LEVEL,
} from "@cesar-mmo/shared";

import type { BattlePokemonState } from "@cesar-mmo/shared";

import {
  getPokemonDisplayName,
  getPokemonMaxHp,
} from "../../../pokemon/pokemon-presentation.utils";

import { getPokemonSpriteAsset } from "../../../pokemon/pokemon-sprite.registry";
import { getPokemonBattleSpriteAsset } from "../../../pokemon/pokemon-battle-sprite.registry";

const SWITCH_OUT_DURATION_MS = 260;
const SWITCH_IN_DURATION_MS = 340;
const FAINT_DURATION_MS = 420;

const CAPTURE_ABSORB_DURATION_MS = 1500;
const CAPTURE_BREAK_FREE_DURATION_MS = 1500;

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
  private readonly side: ModernBattlePokemonHudSide;
  private readonly root: HTMLDivElement;
  private readonly sprite: HTMLImageElement;
  private readonly card: HTMLDivElement;

  private readonly hitSprite: HTMLImageElement;
  private readonly healFx: HTMLDivElement;
  private healFxTimer?: number;
  private healFxResolve?: () => void;

  private readonly name: HTMLDivElement;
  private readonly level: HTMLDivElement;

  private readonly hpText: HTMLSpanElement;
  private readonly hpFill: HTMLDivElement;

  private readonly progression: HTMLDivElement;
  private readonly experienceText: HTMLSpanElement;
  private readonly experienceTrack: HTMLDivElement;
  private readonly experienceFill: HTMLDivElement;

  private pokemonState?: BattlePokemonState;
  private hpAnimationFrame?: number;
  private hpAnimationResolve?: () => void;
  private experienceAnimationTimer?: number;
  private experienceAnimationResolve?: () => void;

  private spriteAnimationTimer?: number;
  private spriteAnimationResolve?: () => void;
  private hitAnimation?: Animation;

  constructor(parent: HTMLElement, side: ModernBattlePokemonHudSide) {
    this.side = side;

    this.root = document.createElement("div");

    this.root.className = [
      "battle-modern-hud",
      `battle-modern-hud--${side}`,
    ].join(" ");

    this.sprite = document.createElement("img");
    this.sprite.className = "battle-modern-hud__sprite";
    this.sprite.alt = "";

    this.hitSprite = document.createElement("img");
    this.hitSprite.className = "battle-modern-hud__hit-sprite";
    this.hitSprite.alt = "";
    this.hitSprite.ariaHidden = "true";

    this.healFx = document.createElement("div");
    this.healFx.className = "battle-modern-hud__heal-fx";
    this.healFx.ariaHidden = "true";

    for (let index = 0; index < 7; index += 1) {
      const particle = document.createElement("span");
      particle.className = "battle-modern-hud__heal-particle";
      this.healFx.appendChild(particle);
    }

    this.card = document.createElement("div");
    this.card.className = [
      "battle-modern-hud__card",
      "battle-ui-modern__surface",
    ].join(" ");

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

    this.progression = document.createElement("div");

    this.progression.className = "battle-progression";

    this.experienceText = document.createElement("span");

    this.experienceText.className = "battle-progression__exp-text";

    this.experienceText.textContent = "EXP";

    this.experienceTrack = document.createElement("div");

    this.experienceTrack.className = "battle-progression__track";

    this.experienceFill = document.createElement("div");

    this.experienceFill.className = "battle-progression__fill";

    this.experienceTrack.appendChild(this.experienceFill);

    this.progression.append(this.experienceText, this.experienceTrack);

    this.card.append(header, hpHeader, hpTrack, this.progression);

    this.root.append(this.sprite, this.hitSprite, this.healFx, this.card);

    parent.appendChild(this.root);

    this.clear();
  }

  public setBounds(
    bounds: ModernBattlePokemonHudBounds,
    viewport: ModernBattlePokemonHudViewport,
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
    this.finishPendingHpAnimation();
    this.finishPendingHitAnimation();
    this.finishPendingSpriteAnimation();
    this.finishPendingExperienceAnimation();

    this.sprite.classList.remove(
      "battle-modern-hud__sprite--switched-out",
      "battle-modern-hud__sprite--fainted",
      "battle-modern-hud__sprite--captured-hidden",
    );

    this.pokemonState = state;

    const pokemon = state.pokemon;

    const maxHp = getPokemonMaxHp(pokemon);

    const currentHp = Math.max(0, Math.min(maxHp, state.currentHp));

    const fallbackAsset = getPokemonSpriteAsset(
      pokemon.speciesId,
      pokemon.formId,
    );

    const battleSpriteSide = this.side === "trainer" ? "back" : "front";

    const battleAsset = getPokemonBattleSpriteAsset(
      pokemon.speciesId,
      pokemon.formId,
      battleSpriteSide,
    );

    this.sprite.onerror = () => {
      this.sprite.onerror = null;
      this.sprite.classList.remove("battle-modern-hud__sprite--battle");
      this.sprite.classList.add("battle-modern-hud__sprite--icon");
      this.sprite.src = fallbackAsset.path;
      this.hitSprite.src = fallbackAsset.path;
    };

    this.sprite.classList.remove("battle-modern-hud__sprite--icon");
    this.sprite.classList.add("battle-modern-hud__sprite--battle");
    this.sprite.src = battleAsset.path;

    this.hitSprite.src = battleAsset.path;

    this.name.textContent = getPokemonDisplayName(pokemon);
    this.level.textContent = `Lv. ${pokemon.level}`;
    this.renderHp(currentHp, maxHp);
    this.renderExperience(pokemon.speciesId, pokemon.experience, pokemon.level);

    if (currentHp === 0) {
      this.sprite.classList.add("battle-modern-hud__sprite--fainted");
    }

    this.sprite.alt = this.name.textContent;

    this.root.hidden = false;
  }

  public clear(): void {
    this.finishPendingHpAnimation();
    this.finishPendingHitAnimation();
    this.finishPendingSpriteAnimation();
    this.finishPendingHealEffect();
    this.finishPendingExperienceAnimation();

    this.pokemonState = undefined;

    this.root.hidden = true;

    this.name.textContent = "";
    this.level.textContent = "";
    this.hpText.textContent = "";

    this.hpFill.style.width = "0%";

    this.hpFill.classList.remove(
      "battle-modern-hud__hp-fill--healthy",
      "battle-modern-hud__hp-fill--warning",
      "battle-modern-hud__hp-fill--danger",
      "battle-modern-hud__hp-fill--animating",
    );

    this.sprite.classList.remove(
      "battle-modern-hud__sprite--switching-out",
      "battle-modern-hud__sprite--switching-in",
      "battle-modern-hud__sprite--switched-out",
      "battle-modern-hud__sprite--fainting",
      "battle-modern-hud__sprite--fainted",

      "battle-modern-hud__sprite--capture-absorbing",
      "battle-modern-hud__sprite--capture-breaking-free",
      "battle-modern-hud__sprite--captured-hidden",
    );

    this.progression.hidden = true;
    this.experienceText.textContent = "EXP";
    this.experienceFill.classList.remove("battle-progression__fill--gaining");
    this.experienceFill.style.width = "0%";

    this.level.classList.remove("battle-progression__level--up");
    this.card.classList.remove("battle-progression__card--level-up");
    this.progression.classList.remove("battle-progression--visible");
    this.experienceFill.style.removeProperty("--battle-exp-duration");

    this.sprite.removeAttribute("src");
    this.hitSprite.removeAttribute("src");
    this.hitSprite.style.opacity = "0";
    this.sprite.alt = "";

    this.root.classList.remove("battle-modern-hud--cinematic-hidden");
  }

  public destroy(): void {
    this.clear();
    this.root.remove();
  }

  private renderHp(currentHp: number, maxHp: number): void {
    const safeMaxHp = Math.max(0, maxHp);
    const safeCurrentHp = Math.max(
      0,
      Math.min(safeMaxHp, Math.round(currentHp)),
    );

    const hpRatio =
      safeMaxHp > 0 ? Math.max(0, Math.min(1, safeCurrentHp / safeMaxHp)) : 0;
    this.hpText.textContent = `${safeCurrentHp} / ${safeMaxHp}`;
    this.hpFill.style.width = `${hpRatio * 100}%`;
    this.hpFill.classList.remove(
      "battle-modern-hud__hp-fill--healthy",
      "battle-modern-hud__hp-fill--warning",
      "battle-modern-hud__hp-fill--danger",
    );

    if (hpRatio > 0.5) {
      this.hpFill.classList.add("battle-modern-hud__hp-fill--healthy");
    } else if (hpRatio > 0.2) {
      this.hpFill.classList.add("battle-modern-hud__hp-fill--warning");
    } else {
      this.hpFill.classList.add("battle-modern-hud__hp-fill--danger");
    }
  }

  private renderExperience(
    speciesId: number,
    experience: number,
    level: number,
  ): void {
    /* Wild Pokémon never need an EXP bar */
    if (this.side !== "trainer") {
      this.progression.hidden = true;
      return;
    }

    this.progression.hidden = false;
    this.progression.classList.add("battle-progression--visible");
    this.experienceText.textContent = "EXP";
    this.setExperienceRatio(
      this.getExperienceLevelRatio(speciesId, experience, level),
    );
  }

  public isDisplayingPokemon(pokemonInstanceId: string): boolean {
    return this.pokemonState?.pokemon.instanceId === pokemonInstanceId;
  }

  public animateHp(
    pokemonInstanceId: string,
    previousHp: number,
    currentHp: number,
    durationMs = 520,
  ): Promise<void> {
    const state = this.pokemonState;

    if (!state || state.pokemon.instanceId !== pokemonInstanceId) {
      return Promise.resolve();
    }

    const maxHp = getPokemonMaxHp(state.pokemon);
    const fromHp = Math.max(0, Math.min(maxHp, previousHp));
    const toHp = Math.max(0, Math.min(maxHp, currentHp));

    this.finishPendingHpAnimation();

    /*
     * First guarantee that presentation starts
     * from the exact authoritative previousHp.
     */
    this.renderHp(fromHp, maxHp);

    if (fromHp === toHp || durationMs <= 0) {
      this.renderHp(toHp, maxHp);

      return Promise.resolve();
    }

    this.hpFill.classList.add("battle-modern-hud__hp-fill--animating");

    const startedAt = performance.now();

    return new Promise<void>((resolve) => {
      this.hpAnimationResolve = resolve;

      const tick = (now: number): void => {
        const elapsed = now - startedAt;
        const progress = Math.max(0, Math.min(1, elapsed / durationMs));
        const displayedHp = Math.round(fromHp + (toHp - fromHp) * progress);
        this.renderHp(displayedHp, maxHp);

        if (progress >= 1) {
          this.hpAnimationFrame = undefined;
          this.hpAnimationResolve = undefined;
          this.hpFill.classList.remove("battle-modern-hud__hp-fill--animating");
          this.renderHp(toHp, maxHp);
          resolve();
          return;
        }
        this.hpAnimationFrame = window.requestAnimationFrame(tick);
      };
      this.hpAnimationFrame = window.requestAnimationFrame(tick);
    });
  }

  public async animateExperienceGain(
    pokemonInstanceId: string,
    gainedExperience: number,
    previousExperience: number,
    currentExperience: number,
    previousLevel: number,
    currentLevel: number,
    durationMs = 900,
  ): Promise<void> {
    const state = this.pokemonState;

    if (!state || state.pokemon.instanceId !== pokemonInstanceId) {
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

    const pokemon = state.pokemon;

    const species = getPokemonSpecies(pokemon.speciesId);

    if (!species) {
      console.warn("[BattleProgression] species missing while animating EXP", {
        speciesId: pokemon.speciesId,
        pokemonInstanceId,
      });

      return;
    }

    this.finishPendingExperienceAnimation();
    this.progression.hidden = false;
    this.progression.classList.add("battle-progression--visible");
    this.experienceText.textContent = `EXP +${gainedExperience}`;
    const prefersReducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const safeDuration = prefersReducedMotion ? 0 : Math.max(0, durationMs);
    const finalRatio = this.getExperienceLevelRatio(
      pokemon.speciesId,
      currentExperience,
      currentLevel,
    );

    if (safeDuration === 0) {
      this.level.textContent = `Lv. ${currentLevel}`;
      this.setExperienceRatio(finalRatio);
      this.experienceText.textContent = "EXP";
      return;
    }

    let displayedLevel = previousLevel;

    let fromRatio = this.getExperienceLevelRatio(
      pokemon.speciesId,
      previousExperience,
      previousLevel,
    );

    this.level.textContent = `Lv. ${displayedLevel}`;
    this.setExperienceRatio(fromRatio);

    while (displayedLevel < currentLevel) {
      await this.animateExperienceRatio(fromRatio, 1, safeDuration);

      if (!this.isDisplayingPokemon(pokemonInstanceId)) {
        return;
      }

      displayedLevel += 1;

      this.level.textContent = `Lv. ${displayedLevel}`;

      /* Lv100 has no next level, so we present a full bar */
      if (displayedLevel >= MAX_POKEMON_LEVEL) {
        this.setExperienceRatio(1);

        fromRatio = 1;
        break;
      }

      /* Level threshold crossed. New level starts at 0% */
      this.setExperienceRatio(0);
      fromRatio = 0;
    }

    /* Animate whatever EXP remains inside the final level */
    if (currentLevel < MAX_POKEMON_LEVEL && finalRatio > fromRatio) {
      await this.animateExperienceRatio(fromRatio, finalRatio, safeDuration);
    } else {
      this.setExperienceRatio(finalRatio);
    }

    if (!this.isDisplayingPokemon(pokemonInstanceId)) {
      return;
    }

    this.level.textContent = `Lv. ${currentLevel}`;
    this.setExperienceRatio(finalRatio);
    this.experienceText.textContent = "EXP";
  }

  public setCinematicHidden(hidden: boolean): void {
    this.root.classList.toggle("battle-modern-hud--cinematic-hidden", hidden);
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

  private setExperienceRatio(ratio: number): void {
    const safeRatio = Math.max(0, Math.min(1, ratio));
    this.experienceFill.style.width = `${safeRatio * 100}%`;
  }

  private animateExperienceRatio(
    fromRatio: number,
    toRatio: number,
    fullBarDurationMs: number,
  ): Promise<void> {
    this.finishPendingExperienceAnimation();

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

    this.experienceFill.classList.remove("battle-progression__fill--gaining");

    this.setExperienceRatio(safeFrom);

    this.experienceFill.style.setProperty(
      "--battle-exp-duration",
      `${durationMs}ms`,
    );

    void this.experienceFill.offsetWidth;

    this.experienceFill.classList.add("battle-progression__fill--gaining");

    this.setExperienceRatio(safeTo);

    return new Promise<void>((resolve) => {
      this.experienceAnimationResolve = resolve;
      this.experienceAnimationTimer = window.setTimeout(() => {
        this.experienceAnimationTimer = undefined;
        this.experienceAnimationResolve = undefined;
        this.experienceFill.classList.remove(
          "battle-progression__fill--gaining",
        );
        resolve();
      }, durationMs);
    });
  }

  private finishPendingExperienceAnimation(): void {
    if (this.experienceAnimationTimer !== undefined) {
      window.clearTimeout(this.experienceAnimationTimer);
      this.experienceAnimationTimer = undefined;
    }

    this.experienceFill.classList.remove("battle-progression__fill--gaining");
    this.experienceFill.style.removeProperty("--battle-exp-duration");
    const resolve = this.experienceAnimationResolve;
    this.experienceAnimationResolve = undefined;
    resolve?.();
  }

  public animateLevelUp(
    pokemonInstanceId: string,
    currentLevel: number,
    durationMs = 900,
  ): Promise<void> {
    if (!this.isDisplayingPokemon(pokemonInstanceId)) {
      return Promise.resolve();
    }

    if (
      !Number.isInteger(currentLevel) ||
      currentLevel < 1 ||
      currentLevel > 100
    ) {
      return Promise.resolve();
    }

    /* El Level viene del evento autoritativo enviado por el servidor */
    this.level.textContent = `Lv. ${currentLevel}`;

    const prefersReducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    const safeDuration = prefersReducedMotion ? 0 : Math.max(0, durationMs);

    this.level.classList.remove("battle-progression__level--up");
    this.card.classList.remove("battle-progression__card--level-up");

    /* Restart animation */
    void this.level.offsetWidth;
    this.level.classList.add("battle-progression__level--up");
    this.card.classList.add("battle-progression__card--level-up");

    if (safeDuration === 0) {
      this.level.classList.remove("battle-progression__level--up");
      this.card.classList.remove("battle-progression__card--level-up");
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      window.setTimeout(() => {
        this.level.classList.remove("battle-progression__level--up");
        this.card.classList.remove("battle-progression__card--level-up");
        resolve();
      }, safeDuration);
    });
  }

  public animateHpRestoreEffect(
    pokemonInstanceId: string,
    isRevive: boolean,
    durationMs = 760,
  ): Promise<void> {
    if (!this.isDisplayingPokemon(pokemonInstanceId)) {
      return Promise.resolve();
    }

    this.finishPendingHealEffect();

    const prefersReducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    const safeDuration = prefersReducedMotion ? 0 : Math.max(0, durationMs);

    if (safeDuration === 0) {
      return Promise.resolve();
    }

    this.syncHealEffectLayout();

    /* Reiniciamos la animación aunque se utilicen varios items consecutivamente */
    this.healFx.classList.remove(
      "battle-modern-hud__heal-fx--active",
      "battle-modern-hud__heal-fx--heal",
      "battle-modern-hud__heal-fx--revive",
    );

    this.sprite.classList.remove(
      "battle-modern-hud__sprite--healing",
      "battle-modern-hud__sprite--reviving",
    );

    void this.healFx.offsetWidth;

    this.healFx.classList.add(
      "battle-modern-hud__heal-fx--active",
      isRevive
        ? "battle-modern-hud__heal-fx--revive"
        : "battle-modern-hud__heal-fx--heal",
    );

    this.sprite.classList.add("battle-modern-hud__sprite--healing");

    if (isRevive) {
      this.sprite.classList.add("battle-modern-hud__sprite--reviving");
    }

    return new Promise<void>((resolve) => {
      this.healFxResolve = resolve;

      this.healFxTimer = window.setTimeout(() => {
        this.healFxTimer = undefined;
        this.healFxResolve = undefined;

        this.healFx.classList.remove(
          "battle-modern-hud__heal-fx--active",
          "battle-modern-hud__heal-fx--heal",
          "battle-modern-hud__heal-fx--revive",
        );

        this.sprite.classList.remove(
          "battle-modern-hud__sprite--healing",
          "battle-modern-hud__sprite--reviving",
        );

        resolve();
      }, safeDuration);
    });
  }

  private finishPendingHpAnimation(): void {
    if (this.hpAnimationFrame !== undefined) {
      window.cancelAnimationFrame(this.hpAnimationFrame);
      this.hpAnimationFrame = undefined;
    }

    this.hpFill.classList.remove("battle-modern-hud__hp-fill--animating");
    const resolve = this.hpAnimationResolve;
    this.hpAnimationResolve = undefined;
    resolve?.();
  }

  public async animateSwitchOut(pokemonInstanceId: string): Promise<void> {
    if (!this.isDisplayingPokemon(pokemonInstanceId)) {
      return;
    }

    await this.playSpriteAnimation(
      "battle-modern-hud__sprite--switching-out",
      SWITCH_OUT_DURATION_MS,
    );

    if (!this.isDisplayingPokemon(pokemonInstanceId)) {
      return;
    }

    this.sprite.classList.add("battle-modern-hud__sprite--switched-out");
  }

  public async animateSwitchIn(state: BattlePokemonState): Promise<void> {
    this.setPokemon(state);

    if (state.currentHp <= 0) {
      return;
    }

    await this.playSpriteAnimation(
      "battle-modern-hud__sprite--switching-in",
      SWITCH_IN_DURATION_MS,
    );
  }

  public async animateHit(pokemonInstanceId: string): Promise<void> {
    if (!this.isDisplayingPokemon(pokemonInstanceId)) {
      return;
    }

    this.syncHitSpriteLayout();

    const currentSpriteSrc = this.sprite.currentSrc || this.sprite.src;

    if (!currentSpriteSrc) {
      return;
    }

    this.hitSprite.src = currentSpriteSrc;
    this.hitSprite.style.opacity = "1";
    await this.delay(100);
    this.hitSprite.style.opacity = "0";
    await this.delay(70);
    this.hitSprite.style.opacity = "0.8";
    await this.delay(90);
    this.hitSprite.style.opacity = "0";
  }

  public async animateFaint(pokemonInstanceId: string): Promise<void> {
    if (!this.isDisplayingPokemon(pokemonInstanceId)) {
      return;
    }

    await this.playSpriteAnimation(
      "battle-modern-hud__sprite--fainting",
      FAINT_DURATION_MS,
    );

    if (!this.isDisplayingPokemon(pokemonInstanceId)) {
      return;
    }

    this.sprite.classList.add("battle-modern-hud__sprite--fainted");
  }

  public async animateCaptureAbsorb(pokemonInstanceId: string): Promise<void> {
    if (!this.isDisplayingPokemon(pokemonInstanceId)) {
      return;
    }
    await this.playSpriteAnimation(
      "battle-modern-hud__sprite--capture-absorbing",
      CAPTURE_ABSORB_DURATION_MS,
    );
    if (!this.isDisplayingPokemon(pokemonInstanceId)) {
      return;
    }
    this.sprite.classList.add("battle-modern-hud__sprite--captured-hidden");
  }

  public async animateCaptureBreakFree(
    pokemonInstanceId: string,
  ): Promise<void> {
    if (!this.isDisplayingPokemon(pokemonInstanceId)) {
      return;
    }
    this.sprite.classList.remove("battle-modern-hud__sprite--captured-hidden");
    await this.playSpriteAnimation(
      "battle-modern-hud__sprite--capture-breaking-free",
      CAPTURE_BREAK_FREE_DURATION_MS,
    );
  }

  private playSpriteAnimation(
    className: string,
    durationMs: number,
  ): Promise<void> {
    this.finishPendingSpriteAnimation();

    const prefersReducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    const safeDuration = prefersReducedMotion ? 0 : Math.max(0, durationMs);

    if (safeDuration === 0) {
      return Promise.resolve();
    }

    this.sprite.style.setProperty(
      "--battle-sprite-animation-duration",
      `${safeDuration}ms`,
    );

    void this.sprite.offsetWidth;

    this.sprite.classList.add(className);

    return new Promise<void>((resolve) => {
      this.spriteAnimationResolve = resolve;

      this.spriteAnimationTimer = window.setTimeout(() => {
        this.spriteAnimationTimer = undefined;
        this.spriteAnimationResolve = undefined;
        this.sprite.classList.remove(className);
        this.sprite.style.removeProperty("--battle-sprite-animation-duration");
        resolve();
      }, safeDuration);
    });
  }

  private finishPendingSpriteAnimation(): void {
    if (this.spriteAnimationTimer !== undefined) {
      window.clearTimeout(this.spriteAnimationTimer);
      this.spriteAnimationTimer = undefined;
    }

    this.sprite.classList.remove(
      "battle-modern-hud__sprite--switching-out",
      "battle-modern-hud__sprite--switching-in",
      "battle-modern-hud__sprite--fainting",

      "battle-modern-hud__sprite--capture-absorbing",
      "battle-modern-hud__sprite--capture-breaking-free",
    );

    this.sprite.style.removeProperty("--battle-sprite-animation-duration");
    const resolve = this.spriteAnimationResolve;
    this.spriteAnimationResolve = undefined;
    resolve?.();
  }

  private finishPendingHitAnimation(): void {
    if (!this.hitAnimation) {
      return;
    }

    this.hitAnimation.cancel();
    this.hitAnimation = undefined;
  }

  private delay(durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      window.setTimeout(resolve, durationMs);
    });
  }

  private syncHitSpriteLayout(): void {
    const computedStyle = window.getComputedStyle(this.sprite);

    this.hitSprite.style.left = `${this.sprite.offsetLeft}px`;
    this.hitSprite.style.top = `${this.sprite.offsetTop}px`;
    this.hitSprite.style.width = `${this.sprite.offsetWidth}px`;
    this.hitSprite.style.height = `${this.sprite.offsetHeight}px`;

    this.hitSprite.style.transform = computedStyle.transform;
    this.hitSprite.style.transformOrigin = computedStyle.transformOrigin;
  }

  public getCaptureThrowOrigin(
    container: HTMLElement,
  ): { x: number; y: number } | null {
    const spriteRect = this.sprite.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    if (spriteRect.width <= 0 || spriteRect.height <= 0) {
      return null;
    }

    return {
      x: spriteRect.left - containerRect.left + spriteRect.width * 0.72,

      y: spriteRect.top - containerRect.top + spriteRect.height * 0.18,
    };
  }

  public getCaptureTargetPoint(
    container: HTMLElement,
  ): { x: number; y: number } | null {
    const spriteRect = this.sprite.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    if (spriteRect.width <= 0 || spriteRect.height <= 0) {
      return null;
    }

    return {
      x: spriteRect.left - containerRect.left + spriteRect.width * 0.5,
      y: spriteRect.top - containerRect.top + spriteRect.height * 0.52,
    };
  }

  public getCaptureGroundPoint(
    container: HTMLElement,
  ): { x: number; y: number } | null {
    const spriteRect = this.sprite.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    if (spriteRect.width <= 0 || spriteRect.height <= 0) {
      return null;
    }

    return {
      x: spriteRect.left - containerRect.left + spriteRect.width * 0.5,
      y: spriteRect.bottom - containerRect.top - 6,
    };
  }

  private syncHealEffectLayout(): void {
    const paddingX = Math.max(14, this.sprite.offsetWidth * 0.08);
    const paddingY = Math.max(12, this.sprite.offsetHeight * 0.06);

    this.healFx.style.left = `${this.sprite.offsetLeft - paddingX}px`;
    this.healFx.style.top = `${this.sprite.offsetTop - paddingY}px`;
    this.healFx.style.width = `${this.sprite.offsetWidth + paddingX * 2}px`;
    this.healFx.style.height = `${this.sprite.offsetHeight + paddingY * 2}px`;
  }

  private finishPendingHealEffect(): void {
    if (this.healFxTimer !== undefined) {
      window.clearTimeout(this.healFxTimer);
      this.healFxTimer = undefined;
    }

    this.healFx.classList.remove(
      "battle-modern-hud__heal-fx--active",
      "battle-modern-hud__heal-fx--heal",
      "battle-modern-hud__heal-fx--revive",
    );

    this.sprite.classList.remove(
      "battle-modern-hud__sprite--healing",
      "battle-modern-hud__sprite--reviving",
    );

    const resolve = this.healFxResolve;
    this.healFxResolve = undefined;
    resolve?.();
  }
}
