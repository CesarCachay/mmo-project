import type {
  BattleType,
  PokemonBattlePresentationContext,
} from "@cesar-mmo/shared";

import { getBattleIntroCopy } from "./battle-ui-copy";

export type BattleImpactSide = "local" | "opponent";

const INTRO_DURATION_MS = 760;
const IMPACT_DURATION_MS = 230;

export class ModernBattleEffectsLayer {
  private readonly root: HTMLDivElement;
  private readonly flash: HTMLDivElement;
  private readonly impact: HTMLDivElement;
  private readonly intro: HTMLDivElement;
  private readonly introEyebrow: HTMLDivElement;
  private readonly introTitle: HTMLDivElement;
  private readonly introSubtitle: HTMLDivElement;

  private introTimer?: number;
  private introResolve?: () => void;
  private impactTimer?: number;
  private impactResolve?: () => void;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "battle-modern-effects";
    this.root.setAttribute("aria-hidden", "true");

    this.flash = document.createElement("div");
    this.flash.className = "battle-modern-effects__flash";

    this.impact = document.createElement("div");
    this.impact.className = "battle-modern-effects__impact";

    this.intro = document.createElement("div");
    this.intro.className = "battle-modern-effects__intro";
    this.intro.hidden = true;

    const introPanel = document.createElement("div");
    introPanel.className = "battle-modern-effects__intro-panel";

    this.introEyebrow = document.createElement("div");
    this.introEyebrow.className = "battle-modern-effects__intro-eyebrow";

    this.introTitle = document.createElement("div");
    this.introTitle.className = "battle-modern-effects__intro-title";

    this.introSubtitle = document.createElement("div");
    this.introSubtitle.className = "battle-modern-effects__intro-subtitle";

    const slash = document.createElement("div");
    slash.className = "battle-modern-effects__intro-slash";

    introPanel.append(
      this.introEyebrow,
      this.introTitle,
      slash,
      this.introSubtitle,
    );

    this.intro.appendChild(introPanel);
    this.root.append(this.flash, this.impact, this.intro);
    parent.appendChild(this.root);
  }

  public async playBattleIntro(
    type: BattleType,
    opponentName?: string,
    presentation?: PokemonBattlePresentationContext,
  ): Promise<void> {
    this.finishIntro();

    const copy = getBattleIntroCopy(type, opponentName, presentation);
    this.introEyebrow.textContent = copy.eyebrow;
    this.introTitle.textContent = copy.title;
    this.introSubtitle.textContent = copy.subtitle;

    const isGymLeader = presentation?.kind === "gym-leader";

    this.root.classList.toggle(
      "battle-modern-effects--trainer",
      type === "trainer" && !isGymLeader,
    );
    this.root.classList.toggle("battle-modern-effects--gym-leader", isGymLeader);
    this.root.classList.toggle("battle-modern-effects--wild", type === "wild");

    this.intro.hidden = false;
    this.flash.classList.remove("battle-modern-effects__flash--intro");
    this.intro.classList.remove("battle-modern-effects__intro--active");

    void this.intro.offsetWidth;

    this.flash.classList.add("battle-modern-effects__flash--intro");
    this.intro.classList.add("battle-modern-effects__intro--active");

    const duration = this.prefersReducedMotion() ? 180 : INTRO_DURATION_MS;

    await new Promise<void>((resolve) => {
      this.introResolve = resolve;
      this.introTimer = window.setTimeout(() => {
        this.introTimer = undefined;
        this.introResolve = undefined;
        this.intro.hidden = true;
        this.intro.classList.remove("battle-modern-effects__intro--active");
        this.flash.classList.remove("battle-modern-effects__flash--intro");
        resolve();
      }, duration);
    });
  }

  public playImpact(side: BattleImpactSide): Promise<void> {
    this.finishImpact();

    this.impact.classList.remove(
      "battle-modern-effects__impact--local",
      "battle-modern-effects__impact--opponent",
      "battle-modern-effects__impact--active",
    );

    this.impact.classList.add(`battle-modern-effects__impact--${side}`);
    void this.impact.offsetWidth;
    this.impact.classList.add("battle-modern-effects__impact--active");

    const duration = this.prefersReducedMotion() ? 60 : IMPACT_DURATION_MS;

    return new Promise<void>((resolve) => {
      this.impactResolve = resolve;
      this.impactTimer = window.setTimeout(() => {
        this.impactTimer = undefined;
        this.impactResolve = undefined;
        this.impact.classList.remove("battle-modern-effects__impact--active");
        resolve();
      }, duration);
    });
  }

  public clear(): void {
    this.finishIntro();
    this.finishImpact();
    this.intro.hidden = true;
    this.intro.classList.remove("battle-modern-effects__intro--active");
    this.flash.classList.remove("battle-modern-effects__flash--intro");
    this.impact.classList.remove(
      "battle-modern-effects__impact--active",
      "battle-modern-effects__impact--local",
      "battle-modern-effects__impact--opponent",
    );
  }

  public destroy(): void {
    this.clear();
    this.root.remove();
  }

  private finishIntro(): void {
    if (this.introTimer !== undefined) {
      window.clearTimeout(this.introTimer);
      this.introTimer = undefined;
    }

    const resolve = this.introResolve;
    this.introResolve = undefined;
    resolve?.();
  }

  private finishImpact(): void {
    if (this.impactTimer !== undefined) {
      window.clearTimeout(this.impactTimer);
      this.impactTimer = undefined;
    }

    const resolve = this.impactResolve;
    this.impactResolve = undefined;
    resolve?.();
  }

  private prefersReducedMotion(): boolean {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  }
}
