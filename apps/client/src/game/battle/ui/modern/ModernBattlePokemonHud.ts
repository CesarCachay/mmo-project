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

  private readonly name: HTMLDivElement;

  private readonly level: HTMLDivElement;

  private readonly hpText: HTMLSpanElement;
  private readonly hpFill: HTMLDivElement;

  private pokemonState?: BattlePokemonState;
  private hpAnimationFrame?: number;
  private hpAnimationResolve?: () => void;

  private spriteAnimationTimer?: number;
  private spriteAnimationResolve?: () => void;
  private hitAnimation?: Animation;

  constructor(parent: HTMLElement, side: ModernBattlePokemonHudSide) {
    this.side = side;

    this.root = document.createElement("div");

    this.root.className = ["battle-modern-hud", `battle-modern-hud--${side}`].join(" ");

    this.sprite = document.createElement("img");
    this.sprite.className = "battle-modern-hud__sprite";
    this.sprite.alt = "";

    this.hitSprite = document.createElement("img");
    this.hitSprite.className = "battle-modern-hud__hit-sprite";
    this.hitSprite.alt = "";
    this.hitSprite.ariaHidden = "true";

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

    this.root.append(this.sprite, this.hitSprite, this.card);

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
    this.finishPendingHpAnimation();
    this.finishPendingHitAnimation();
    this.finishPendingSpriteAnimation();

    this.sprite.classList.remove(
      "battle-modern-hud__sprite--switched-out",
      "battle-modern-hud__sprite--fainted",
      "battle-modern-hud__sprite--captured-hidden"
    );

    this.pokemonState = state;

    const pokemon = state.pokemon;

    const maxHp = getPokemonMaxHp(pokemon);

    const currentHp = Math.max(0, Math.min(maxHp, state.currentHp));

    const fallbackAsset = getPokemonSpriteAsset(pokemon.speciesId, pokemon.formId);

    const battleSpriteSide = this.side === "trainer" ? "back" : "front";

    const battleAsset = getPokemonBattleSpriteAsset(
      pokemon.speciesId,
      pokemon.formId,
      battleSpriteSide
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
      "battle-modern-hud__hp-fill--animating"
    );

    this.sprite.classList.remove(
      "battle-modern-hud__sprite--switching-out",
      "battle-modern-hud__sprite--switching-in",
      "battle-modern-hud__sprite--switched-out",
      "battle-modern-hud__sprite--fainting",
      "battle-modern-hud__sprite--fainted",

      "battle-modern-hud__sprite--capture-absorbing",
      "battle-modern-hud__sprite--capture-breaking-free",
      "battle-modern-hud__sprite--captured-hidden"
    );

    this.sprite.removeAttribute("src");

    this.hitSprite.removeAttribute("src");
    this.hitSprite.style.opacity = "0";

    this.sprite.alt = "";
  }

  public destroy(): void {
    this.clear();
    this.root.remove();
  }

  private renderHp(currentHp: number, maxHp: number): void {
    const safeMaxHp = Math.max(0, maxHp);

    const safeCurrentHp = Math.max(0, Math.min(safeMaxHp, Math.round(currentHp)));

    const hpRatio =
      safeMaxHp > 0 ? Math.max(0, Math.min(1, safeCurrentHp / safeMaxHp)) : 0;

    this.hpText.textContent = `${safeCurrentHp} / ${safeMaxHp}`;

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
  }

  public isDisplayingPokemon(pokemonInstanceId: string): boolean {
    return this.pokemonState?.pokemon.instanceId === pokemonInstanceId;
  }

  public animateHp(
    pokemonInstanceId: string,
    previousHp: number,
    currentHp: number,
    durationMs = 520
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
      SWITCH_OUT_DURATION_MS
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
      SWITCH_IN_DURATION_MS
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
      FAINT_DURATION_MS
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
      CAPTURE_ABSORB_DURATION_MS
    );
    if (!this.isDisplayingPokemon(pokemonInstanceId)) {
      return;
    }
    this.sprite.classList.add("battle-modern-hud__sprite--captured-hidden");
  }

  public async animateCaptureBreakFree(pokemonInstanceId: string): Promise<void> {
    if (!this.isDisplayingPokemon(pokemonInstanceId)) {
      return;
    }
    this.sprite.classList.remove("battle-modern-hud__sprite--captured-hidden");
    await this.playSpriteAnimation(
      "battle-modern-hud__sprite--capture-breaking-free",
      CAPTURE_BREAK_FREE_DURATION_MS
    );
  }

  private playSpriteAnimation(className: string, durationMs: number): Promise<void> {
    this.finishPendingSpriteAnimation();

    const prefersReducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    const safeDuration = prefersReducedMotion ? 0 : Math.max(0, durationMs);

    if (safeDuration === 0) {
      return Promise.resolve();
    }

    this.sprite.style.setProperty(
      "--battle-sprite-animation-duration",
      `${safeDuration}ms`
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
      "battle-modern-hud__sprite--capture-breaking-free"
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

  public getCaptureThrowOrigin(container: HTMLElement): { x: number; y: number } | null {
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

  public getCaptureTargetPoint(container: HTMLElement): { x: number; y: number } | null {
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

  public getCaptureGroundPoint(container: HTMLElement): { x: number; y: number } | null {
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
}
