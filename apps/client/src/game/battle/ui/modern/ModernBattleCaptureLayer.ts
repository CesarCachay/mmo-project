export interface ModernBattleCaptureAnchors {
  readonly throwStart: {
    readonly x: number;
    readonly y: number;
  };

  readonly targetPoint: {
    readonly x: number;
    readonly y: number;
  };

  readonly groundPoint: {
    readonly x: number;
    readonly y: number;
  };
}

export interface ModernBattleCaptureAnimationOptions {
  readonly itemAssetPath: string;

  readonly shakeCount: number;
  readonly captured: boolean;

  readonly onAbsorb: () => void | Promise<void>;
  readonly onBreakFree?: () => void | Promise<void>;
}

interface CapturePoint {
  readonly x: number;
  readonly y: number;
}

const THROW_DURATION_MS = 620;
const ABSORB_HOLD_MS = 160;
const LAND_DURATION_MS = 300;
const LAND_BOUNCE_DURATION_MS = 240;
const PRE_SHAKE_PAUSE_MS = 420;
const SHAKE_DURATION_MS = 560;
const SHAKE_PAUSE_MS = 320;
const POST_SHAKE_PAUSE_MS = 460;
const SHAKE_FLASH_DURATION_MS = 280;
const SUCCESS_DURATION_MS = 680;
const FAILURE_DURATION_MS = 460;

export class ModernBattleCaptureLayer {
  private readonly root: HTMLDivElement;
  private readonly ball: HTMLImageElement;
  private readonly particleLayer: HTMLDivElement;
  private readonly flash: HTMLDivElement;
  private readonly focusBackdrop: HTMLDivElement;
  private readonly shockwave: HTMLDivElement;

  private throwStart?: CapturePoint;
  private targetPoint?: CapturePoint;
  private groundPoint?: CapturePoint;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "battle-modern-capture";
    this.root.hidden = true;

    this.ball = document.createElement("img");
    this.ball.className = "battle-modern-capture__ball";
    this.ball.alt = "";
    this.ball.ariaHidden = "true";
    this.ball.draggable = false;

    this.focusBackdrop = document.createElement("div");
    this.focusBackdrop.className = "battle-modern-capture__focus";
    this.focusBackdrop.ariaHidden = "true";

    this.shockwave = document.createElement("div");
    this.shockwave.className = "battle-modern-capture__shockwave";
    this.shockwave.ariaHidden = "true";

    this.particleLayer = document.createElement("div");
    this.particleLayer.className = "battle-modern-capture__particles";

    this.flash = document.createElement("div");
    this.flash.className = "battle-modern-capture__flash";
    this.flash.ariaHidden = "true";

    this.root.append(
      this.focusBackdrop,
      this.shockwave,
      this.flash,
      this.particleLayer,
      this.ball
    );
    parent.appendChild(this.root);
  }

  public setAnchors(anchors: ModernBattleCaptureAnchors): void {
    this.throwStart = anchors.throwStart;
    this.targetPoint = anchors.targetPoint;
    this.groundPoint = anchors.groundPoint;
  }

  public async playCapture(options: ModernBattleCaptureAnimationOptions): Promise<void> {
    const { itemAssetPath, shakeCount, captured, onAbsorb, onBreakFree } = options;

    if (!Number.isInteger(shakeCount) || shakeCount < 0 || shakeCount > 4) {
      console.warn("[ModernBattleCaptureLayer] invalid shakeCount", shakeCount);

      return;
    }

    const start = this.throwStart;
    const target = this.targetPoint;
    const ground = this.groundPoint;

    if (!start || !target || !ground) {
      console.warn("[ModernBattleCaptureLayer] capture layout missing");

      return;
    }

    this.reset();
    this.ball.src = itemAssetPath;

    /*
     * Intentamos tener la imagen decodificada antes de iniciar el throw para evitar
     * un frame vacío durante la animación.
     */
    try {
      await this.ball.decode();
    } catch {
      /* La carga del asset no debe romper Battle Presentation */
    }
    /* La Ball debe recibir su posición ANTES de hacer visible el CaptureLayer */
    this.setBallPosition(start);
    this.ball.style.opacity = "1";

    this.root.hidden = false;

    /* Focus y Throw empiezan juntos */
    await Promise.all([
      this.playFocusIn(),
      this.animate(
        this.ball,
        [
          {
            left: `${start.x}px`,
            top: `${start.y}px`,
            transform: "translate(-50%, -50%) rotate(-20deg)",
            opacity: 1,
          },
          {
            left: `${start.x + (target.x - start.x) * 0.48}px`,
            top: `${Math.min(start.y, target.y) - 105}px`,
            transform: "translate(-50%, -50%) rotate(180deg)",
            opacity: 1,
          },
          {
            left: `${target.x}px`,
            top: `${target.y}px`,
            transform: "translate(-50%, -50%) rotate(360deg)",
            opacity: 1,
          },
        ],
        THROW_DURATION_MS,
        "cubic-bezier(0.22, 0.7, 0.28, 1)"
      ),
    ]);

    this.setBallPosition(target);

    /* 2. WILD → BALL */
    this.ball.classList.add("battle-modern-capture__ball--absorbing");

    await Promise.all([
      Promise.resolve(onAbsorb()),
      this.playFlash(target, "strong"),
      this.playShockwave(target, "strong"),
      this.playParticleBurst(target, "absorb"),
    ]);

    await this.delay(ABSORB_HOLD_MS);

    this.ball.classList.remove("battle-modern-capture__ball--absorbing");

    /* 3. BALL DROP */
    await this.animate(
      this.ball,
      [
        {
          left: `${target.x}px`,
          top: `${target.y}px`,
          transform: "translate(-50%, -50%) scale(1) rotate(0deg)",
        },
        {
          left: `${ground.x}px`,
          top: `${ground.y}px`,
          transform: "translate(-50%, -50%) scale(0.88, 1.12) rotate(35deg)",
        },
      ],
      LAND_DURATION_MS,
      "cubic-bezier(0.45, 0, 0.75, 0.45)"
    );

    this.setBallPosition(ground);

    /* 3.1 IMPACT + BOUNCE */
    await this.animate(
      this.ball,
      [
        {
          left: `${ground.x}px`,
          top: `${ground.y}px`,
          transform: "translate(-50%, -50%) scale(1.18, 0.82) rotate(35deg)",
        },
        {
          left: `${ground.x}px`,
          top: `${ground.y - 15}px`,
          transform: "translate(-50%, -50%) scale(0.94, 1.06) rotate(12deg)",
          offset: 0.42,
        },
        {
          left: `${ground.x}px`,
          top: `${ground.y}px`,
          transform: "translate(-50%, -50%) scale(1) rotate(0deg)",
        },
      ],
      LAND_BOUNCE_DURATION_MS,
      "ease-out"
    );
    this.setBallPosition(ground);

    await this.delay(PRE_SHAKE_PAUSE_MS);

    /*
     * 4. AUTHORITATIVE SHAKES
     * No RNG aquí. Sólo reproducimos el shakeCount recibido del Server.
     */
    for (let index = 0; index < shakeCount; index += 1) {
      await this.playShake(ground, index);
      await this.playFlash(ground, "soft");
      await this.delay(SHAKE_PAUSE_MS);
    }

    if (shakeCount > 0) {
      await this.delay(POST_SHAKE_PAUSE_MS);
    }

    /* 5. RESULT */
    if (captured) {
      await this.playSuccess();

      return;
    }

    await Promise.all([
      this.playFailure(),
      this.playShockwave(ground, "strong"),
      this.playFlash(ground, "strong"),

      /* Partículas pequeñas del escape */
      this.playParticleBurst(ground, "break-free"),
      /* Estrellas grandes de resolución */
      this.playResultBurst(ground, "failure"),
      onBreakFree ? Promise.resolve(onBreakFree()) : Promise.resolve(),
    ]);

    await this.playFocusOut();

    this.root.hidden = true;
  }

  public clear(): void {
    this.reset();
    this.ball.removeAttribute("src");
  }

  public destroy(): void {
    this.clear();
    this.root.remove();
  }

  private async playShake(ground: CapturePoint, shakeIndex: number): Promise<void> {
    const direction = shakeIndex % 2 === 0 ? -1 : 1;
    const distance = 16;

    await this.animate(
      this.ball,
      [
        {
          left: `${ground.x}px`,
          top: `${ground.y}px`,
          transform: "translate(-50%, -50%) rotate(0deg)",
        },
        {
          left: `${ground.x + direction * distance}px`,
          top: `${ground.y - 2}px`,
          transform: `translate(-50%, -50%) rotate(${direction * 24}deg)`,
          offset: 0.28,
        },
        {
          left: `${ground.x}px`,
          top: `${ground.y - 5}px`,
          transform: "translate(-50%, -50%) rotate(0deg)",
          offset: 0.5,
        },
        {
          left: `${ground.x - direction * distance}px`,
          top: `${ground.y - 2}px`,
          transform: `translate(-50%, -50%) rotate(${direction * -20}deg)`,
          offset: 0.72,
        },
        {
          left: `${ground.x}px`,
          top: `${ground.y}px`,
          transform: "translate(-50%, -50%) rotate(0deg)",
        },
      ],
      SHAKE_DURATION_MS,
      "cubic-bezier(0.4, 0, 0.2, 1)"
    );

    this.setBallPosition(ground);
  }

  private async playSuccess(): Promise<void> {
    const ground = this.groundPoint;
    if (!ground) {
      return;
    }

    this.ball.classList.add("battle-modern-capture__ball--success");

    await Promise.all([
      this.playFlash(ground, "strong"),
      this.playShockwave(ground, "normal"),
      this.playResultBurst(ground, "success"),
      this.animate(
        this.ball,
        [
          {
            transform: "translate(-50%, -50%) scale(1)",
            filter: "brightness(1)",
          },
          {
            transform: "translate(-50%, -50%) scale(1.16)",
            filter: "brightness(2.1)",
            offset: 0.24,
          },
          {
            transform: "translate(-50%, -50%) scale(1.05)",
            filter: "brightness(1.35)",
            offset: 0.58,
          },
          {
            transform: "translate(-50%, -50%) scale(1)",
            filter: "brightness(1)",
          },
        ],
        SUCCESS_DURATION_MS,
        "ease-out"
      ),
    ]);

    await this.playFocusOut();
  }

  private async playFailure(): Promise<void> {
    this.ball.classList.add("battle-modern-capture__ball--failed");

    await this.animate(
      this.ball,
      [
        {
          transform: "translate(-50%, -50%) scale(1)",
          opacity: 1,
        },

        {
          transform: "translate(-50%, -50%) scale(1.22)",
          opacity: 0.8,
        },

        {
          transform: "translate(-50%, -50%) scale(0.85)",
          opacity: 0,
        },
      ],
      FAILURE_DURATION_MS,
      "ease-out"
    );
  }

  private setBallPosition(point: CapturePoint): void {
    this.ball.style.left = `${point.x}px`;
    this.ball.style.top = `${point.y}px`;

    this.ball.style.transform = "translate(-50%, -50%)";
  }

  private animate(
    element: HTMLElement,
    keyframes: Keyframe[],
    durationMs: number,
    easing: string
  ): Promise<void> {
    const reducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    const duration = reducedMotion ? 1 : durationMs;
    const animation = element.animate(keyframes, {
      duration,
      easing,
      fill: "forwards",
    });

    return animation.finished
      .then(() => {
        /*
         * Conservamos visualmente el último
         * frame como estilo inline y luego
         * eliminamos la Animation terminada.
         *
         * Evita que Throw/Land compitan después con Shake.
         */
        try {
          animation.commitStyles();
        } catch {
          /* Algunos browsers pueden no soportarlo completamente */
        }

        animation.cancel();
      })
      .catch(() => undefined);
  }

  private delay(durationMs: number): Promise<void> {
    const reducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    if (reducedMotion) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      window.setTimeout(resolve, durationMs);
    });
  }

  private reset(): void {
    this.root.hidden = true;

    this.ball.getAnimations().forEach((animation) => {
      animation.cancel();
    });

    for (const particle of this.particleLayer.children) {
      particle.getAnimations().forEach((animation) => {
        animation.cancel();
      });
    }
    this.particleLayer.replaceChildren();

    this.ball.classList.remove(
      "battle-modern-capture__ball--absorbing",
      "battle-modern-capture__ball--success",
      "battle-modern-capture__ball--failed"
    );

    this.ball.style.left = "";
    this.ball.style.top = "";
    this.ball.style.transform = "";
    this.ball.style.opacity = "";
    this.ball.style.filter = "";

    this.flash.getAnimations().forEach((animation) => {
      animation.cancel();
    });

    this.flash.style.left = "";
    this.flash.style.top = "";
    this.flash.style.width = "";
    this.flash.style.height = "";
    this.flash.style.opacity = "";
    this.flash.style.transform = "";

    this.focusBackdrop.getAnimations().forEach((animation) => {
      animation.cancel();
    });
    this.focusBackdrop.style.opacity = "";

    this.shockwave.getAnimations().forEach((animation) => {
      animation.cancel();
    });
    this.shockwave.style.left = "";
    this.shockwave.style.top = "";
    this.shockwave.style.width = "";
    this.shockwave.style.height = "";
    this.shockwave.style.opacity = "";
    this.shockwave.style.transform = "";
  }

  private async playParticleBurst(
    point: CapturePoint,
    type: "absorb" | "break-free"
  ): Promise<void> {
    const reducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    const particleCount = reducedMotion ? 6 : type === "absorb" ? 14 : 18;
    const animations: Promise<void>[] = [];

    for (let index = 0; index < particleCount; index += 1) {
      const particle = document.createElement("span");
      particle.className = "battle-modern-capture__particle";
      particle.style.left = `${point.x}px`;
      particle.style.top = `${point.y}px`;

      /* Patrón determinista */
      const angle =
        (Math.PI * 2 * index) / particleCount + (index % 2 === 0 ? 0.08 : -0.08);

      const distance = 34 + (index % 4) * 8;

      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;

      const size = 3 + (index % 3) * 2;
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;

      this.particleLayer.appendChild(particle);

      const keyframes: Keyframe[] =
        type === "absorb"
          ? [
              {
                transform: `translate(${dx}px, ${dy}px) scale(0.5)`,
                opacity: 0,
              },

              {
                transform: `translate(${dx * 0.72}px, ${dy * 0.72}px) scale(1)`,
                opacity: 1,
                offset: 0.2,
              },

              {
                transform: "translate(0px, 0px) scale(0.15)",
                opacity: 0,
              },
            ]
          : [
              {
                transform: "translate(0px, 0px) scale(0.35)",
                opacity: 1,
              },

              {
                transform: `translate(${dx * 0.45}px, ${dy * 0.45}px) scale(1.25)`,
                opacity: 1,
                offset: 0.32,
              },

              {
                transform: `translate(${dx}px, ${dy}px) scale(0.35)`,
                opacity: 0,
              },
            ];

      const durationMs = reducedMotion ? 1 : type === "absorb" ? 380 : 460;

      const animation = particle.animate(keyframes, {
        duration: durationMs,
        delay: reducedMotion ? 0 : (index % 5) * 14,
        easing:
          type === "absorb"
            ? "cubic-bezier(0.4, 0, 1, 1)"
            : "cubic-bezier(0, 0.7, 0.25, 1)",
        fill: "forwards",
      });

      animations.push(
        animation.finished
          .catch(() => undefined)
          .then(() => {
            particle.remove();
          })
      );
    }

    await Promise.all(animations);
  }

  private async playFlash(
    point: CapturePoint,
    intensity: "soft" | "strong"
  ): Promise<void> {
    const size = intensity === "strong" ? 150 : 110;

    this.flash.style.left = `${point.x}px`;
    this.flash.style.top = `${point.y}px`;
    this.flash.style.width = `${size}px`;
    this.flash.style.height = `${size}px`;

    const maxOpacity = intensity === "strong" ? 0.9 : 0.58;

    await this.animate(
      this.flash,
      [
        {
          transform: "translate(-50%, -50%) scale(0.15)",
          opacity: 0,
        },
        {
          transform: "translate(-50%, -50%) scale(0.72)",
          opacity: maxOpacity,
          offset: 0.24,
        },
        {
          transform: "translate(-50%, -50%) scale(1.35)",
          opacity: 0,
        },
      ],
      intensity === "strong" ? 280 : SHAKE_FLASH_DURATION_MS,
      "ease-out"
    );
  }

  private async playFocusIn(): Promise<void> {
    await this.animate(
      this.focusBackdrop,
      [{ opacity: 0 }, { opacity: 1 }],
      240,
      "ease-out"
    );
  }

  private async playFocusOut(): Promise<void> {
    await this.animate(
      this.focusBackdrop,
      [{ opacity: 1 }, { opacity: 0 }],
      260,
      "ease-in"
    );
  }

  private async playShockwave(
    point: CapturePoint,
    intensity: "normal" | "strong"
  ): Promise<void> {
    const size = intensity === "strong" ? 180 : 130;

    this.shockwave.style.left = `${point.x}px`;
    this.shockwave.style.top = `${point.y}px`;
    this.shockwave.style.width = `${size}px`;
    this.shockwave.style.height = `${size}px`;

    await this.animate(
      this.shockwave,
      [
        {
          transform: "translate(-50%, -50%) scale(0.18)",
          opacity: 0,
        },
        {
          transform: "translate(-50%, -50%) scale(0.32)",
          opacity: intensity === "strong" ? 0.95 : 0.7,
          offset: 0.12,
        },
        {
          transform: "translate(-50%, -50%) scale(1.35)",
          opacity: 0,
        },
      ],
      intensity === "strong" ? 420 : 320,
      "cubic-bezier(0.15, 0.65, 0.25, 1)"
    );
  }

  private async playResultBurst(
    point: CapturePoint,
    result: "success" | "failure"
  ): Promise<void> {
    const reducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    const particleCount = reducedMotion ? 8 : result === "success" ? 24 : 22;

    const animations: Promise<void>[] = [];

    for (let index = 0; index < particleCount; index += 1) {
      const particle = document.createElement("span");

      particle.className = "battle-modern-capture__particle";

      /*
       * La estrella se define aquí para que
       * Success y Failure compartan exactamente
       * el mismo lenguaje visual.
       */
      particle.style.clipPath = [
        "polygon(",
        "50% 0%,",
        "61% 37%,",
        "100% 50%,",
        "61% 63%,",
        "50% 100%,",
        "39% 63%,",
        "0% 50%,",
        "39% 37%",
        ")",
      ].join(" ");

      particle.style.background = "#ffffff";

      particle.style.left = `${point.x}px`;

      particle.style.top = `${point.y}px`;

      const angle = (Math.PI * 2 * index) / particleCount - Math.PI / 2;

      /*
       * Mucho más grande que antes.
       *
       * Antes:
       * 45–72px success
       *
       * Ahora:
       * aprox. 82–138px.
       */
      const distance = 82 + (index % 5) * 14;

      const dx = Math.cos(angle) * distance;

      const dy = Math.sin(angle) * distance;

      const size = 6 + (index % 4) * 2;

      particle.style.width = `${size}px`;

      particle.style.height = `${size}px`;

      particle.style.filter =
        result === "success"
          ? [
              "drop-shadow(",
              "0 0 6px",
              "rgba(255,255,255,1)",
              ")",
              "drop-shadow(",
              "0 0 12px",
              "rgba(147,197,253,0.85)",
              ")",
            ].join(" ")
          : [
              "drop-shadow(",
              "0 0 6px",
              "rgba(255,255,255,1)",
              ")",
              "drop-shadow(",
              "0 0 11px",
              "rgba(226,232,240,0.75)",
              ")",
            ].join(" ");

      this.particleLayer.appendChild(particle);

      const animation = particle.animate(
        [
          {
            transform: "translate(0px, 0px) scale(0.15) rotate(0deg)",
            opacity: 0,
          },
          {
            transform: `translate(${dx * 0.32}px, ${
              dy * 0.32
            }px) scale(1.5) rotate(45deg)`,
            opacity: 1,
            offset: 0.24,
          },
          {
            transform: `translate(${dx * 0.72}px, ${dy * 0.72}px) scale(1) rotate(90deg)`,
            opacity: 0.9,
            offset: 0.58,
          },
          {
            transform: `translate(${dx}px, ${dy}px) scale(0.2) rotate(150deg)`,
            opacity: 0,
          },
        ],
        {
          duration: reducedMotion ? 1 : result === "success" ? 900 : 720,
          delay: reducedMotion ? 0 : (index % 6) * 18,
          easing: "cubic-bezier(0.15, 0.7, 0.25, 1)",
          fill: "forwards",
        }
      );

      animations.push(
        animation.finished
          .catch(() => undefined)
          .then(() => {
            particle.remove();
          })
      );
    }

    await Promise.all(animations);
  }
}
