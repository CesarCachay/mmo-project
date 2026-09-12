import { POKEMON_EVOLUTION_ANIMATION_TIMING as TIMING } from "../../evolution/pokemon-evolution-animation-timing";

export interface ModernBattleEvolutionLayerBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ModernBattleEvolutionLayerViewport {
  readonly width: number;
  readonly height: number;
}

export class ModernBattleEvolutionLayer {
  private readonly root: HTMLDivElement;
  private readonly glow: HTMLDivElement;
  private readonly sprite: HTMLImageElement;
  private readonly flash: HTMLDivElement;

  private readonly rays: HTMLDivElement;
  private readonly particles: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "battle-modern-evolution-layer";

    this.glow = document.createElement("div");
    this.glow.className = "battle-modern-evolution-layer__glow";

    this.rays = document.createElement("div");
    this.rays.className = "battle-modern-evolution-layer__rays";
    this.rays.setAttribute("aria-hidden", "true");
    this.particles = document.createElement("div");
    this.particles.className = "battle-modern-evolution-layer__particles";
    this.particles.setAttribute("aria-hidden", "true");

    for (let index = 0; index < 12; index += 1) {
      const particle = document.createElement("span");
      particle.style.setProperty("--evolution-angle", `${index * 30}deg`);
      particle.style.setProperty(
        "--evolution-delay",
        `${-(index % 6) * 0.12}s`,
      );
      this.particles.appendChild(particle);
    }

    this.sprite = document.createElement("img");
    this.sprite.className = "battle-modern-evolution-layer__sprite";
    this.sprite.alt = "";

    this.flash = document.createElement("div");
    this.flash.className = "battle-modern-evolution-layer__flash";

    this.root.append(
      this.glow,
      this.rays,
      this.particles,
      this.sprite,
      this.flash,
    );
    parent.appendChild(this.root);
    this.clear();
  }

  public setBounds(
    bounds: ModernBattleEvolutionLayerBounds,
    viewport: ModernBattleEvolutionLayerViewport,
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

  public showSprite(src: string, alt: string): void {
    this.root.dataset.phase = "charging";

    this.sprite.src = src;
    this.sprite.alt = alt;

    this.root.hidden = false;
  }

  public async swapSprite(
    src: string,
    alt: string,
    durationMs: number,
  ): Promise<void> {
    this.showSprite(src, alt);

    /* showSprite vuelve a poner charging, así que restablecemos rapid */
    this.root.dataset.phase = "rapid";

    const spriteAnimation = this.sprite.animate(
      [
        {
          opacity: 0.72,
          transform: "scale(0.94)",
          filter: "brightness(1.8)",
        },
        {
          opacity: 1,
          transform: "scale(1.04)",
          filter: "brightness(1.2)",
        },
        {
          opacity: 1,
          transform: "scale(1)",
          filter: "brightness(1)",
        },
      ],
      {
        duration: durationMs,
        easing: "ease-out",
      },
    );

    const flashAnimation = this.flash.animate(
      [{ opacity: 0 }, { opacity: 0.42 }, { opacity: 0 }],
      {
        duration: Math.max(70, Math.min(130, durationMs)),

        easing: "ease-in-out",
      },
    );

    await Promise.all([
      this.waitForAnimation(spriteAnimation),

      this.waitForAnimation(flashAnimation),
    ]);
  }

  public async revealTarget(src: string, alt: string): Promise<void> {
    /*
     * Bright flash grows first.
     * Target sprite is swapped while the field
     * is visually covered by the flash.
     */
    const flashIn = this.flash.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: TIMING.finalFlashInMs,
      easing: "ease-in",
      fill: "forwards",
    });

    await this.waitForAnimation(flashIn);

    this.showSprite(src, alt);

    this.root.dataset.phase = "final";

    const flashOut = this.flash.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: TIMING.finalFlashOutMs,
      easing: "ease-out",
      fill: "forwards",
    });

    const reveal = this.sprite.animate(
      [
        {
          opacity: 0.35,
          transform: "scale(0.78)",
          filter: "brightness(3)",
        },
        {
          opacity: 1,
          transform: "scale(1.1)",
          filter: "brightness(1.3)",
        },
        {
          opacity: 1,
          transform: "scale(1)",
          filter: "brightness(1)",
        },
      ],
      {
        duration: TIMING.finalTargetRevealMs,
        easing: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    );

    await Promise.all([
      this.waitForAnimation(flashOut),

      this.waitForAnimation(reveal),
    ]);
  }

  public clear(): void {
    this.root.hidden = true;

    this.sprite.removeAttribute("src");
    this.sprite.alt = "";

    this.flash.getAnimations().forEach((animation) => {
      animation.cancel();
    });

    this.sprite.getAnimations().forEach((animation) => {
      animation.cancel();
    });

    delete this.root.dataset.phase;
  }

  public destroy(): void {
    this.clear();
    this.root.remove();
  }

  private async waitForAnimation(animation: Animation): Promise<void> {
    try {
      await animation.finished;
    } catch {
      /*
       * Cancellation during Battle cleanup is
       * expected and must not reject presentation.
       */
    }
  }
}
