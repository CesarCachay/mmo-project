import Phaser from "phaser";

import type {
  PokemonCenterHealedPayload,
  PokemonCenterHealingErrorPayload,
} from "@cesar-mmo/shared";

import "./pokemon-center-healing-presentation.css";

const INTRO_DURATION_MS = 350;
const DOT_STEP_DURATION_MS = 180;
const ALL_DOTS_COMPLETE_DURATION_MS = 300;

const SUCCESS_MESSAGE_DURATION_MS = 1200;
const ERROR_MESSAGE_DURATION_MS = 1500;

const PANEL_OUT_DURATION_MS = 170;

export interface PokemonCenterHealingPresentationControllerOptions {
  readonly onHealingStep?: (stepNumber: number, totalSteps: number) => void;
  readonly onHealingSuccessReveal?: () => void;
}

export class PokemonCenterHealingPresentationController {
  private readonly scene: Phaser.Scene;

  private readonly root: HTMLDivElement;
  private readonly panel: HTMLDivElement;
  private readonly messageElement: HTMLDivElement;
  private readonly statusDots: HTMLSpanElement[];

  private readonly onHealingStep?: PokemonCenterHealingPresentationControllerOptions["onHealingStep"];
  private readonly onHealingSuccessReveal?: PokemonCenterHealingPresentationControllerOptions["onHealingSuccessReveal"];

  private sequenceTimer?: Phaser.Time.TimerEvent;
  private finishTimer?: Phaser.Time.TimerEvent;
  private panelTransitionTimer?: Phaser.Time.TimerEvent;

  private active = false;
  private currentDotIndex = 0;

  private pendingSuccess?: PokemonCenterHealedPayload;
  private visualSequenceComplete = false;

  constructor(
    scene: Phaser.Scene,
    options: PokemonCenterHealingPresentationControllerOptions = {}
  ) {
    this.scene = scene;
    this.onHealingStep = options.onHealingStep;
    this.onHealingSuccessReveal = options.onHealingSuccessReveal;

    const app = document.getElementById("app");

    if (!(app instanceof HTMLElement)) {
      throw new Error('PokemonCenterHealingPresentationController requires "#app"');
    }

    this.root = document.createElement("div");
    this.root.className = "pokemon-center-healing-presentation";
    this.root.hidden = true;

    this.root.innerHTML = `
      <div class="pokemon-center-healing-presentation__panel" role="status" aria-live="polite">
        <div class="pokemon-center-healing-presentation__header">
          CENTRO POKÉMON
        </div>

        <div
          class="pokemon-center-healing-presentation__message"
          data-pokemon-center-healing-message
        ></div>

        <div
          class="pokemon-center-healing-presentation__dots"
          aria-hidden="true"
          data-pokemon-center-healing-dots
        >
          ${Array.from({ length: 6 }, () => '<span class="pokemon-center-healing-presentation__dot"></span>').join("")}
        </div>
      </div>
    `;

    const panel = this.root.querySelector<HTMLDivElement>(
      ".pokemon-center-healing-presentation__panel"
    );
    const messageElement = this.root.querySelector<HTMLDivElement>(
      "[data-pokemon-center-healing-message]"
    );
    const statusDots = Array.from(
      this.root.querySelectorAll<HTMLSpanElement>(
        ".pokemon-center-healing-presentation__dot"
      )
    );

    if (!panel || !messageElement || statusDots.length !== 6) {
      throw new Error("Could not create Pokémon Center healing presentation");
    }

    this.panel = panel;
    this.messageElement = messageElement;
    this.statusDots = statusDots;

    app.append(this.root);
  }

  public get isBlockingGameplay(): boolean {
    return this.active;
  }

  public beginHealing(): void {
    this.clearRuntimeEffects();

    this.active = true;
    this.pendingSuccess = undefined;
    this.visualSequenceComplete = false;
    this.currentDotIndex = 0;

    this.resetDots();
    this.messageElement.textContent = "Un momento, por favor...";

    this.showPanel();

    this.sequenceTimer = this.scene.time.delayedCall(INTRO_DURATION_MS, () => {
      this.sequenceTimer = undefined;

      if (!this.active) {
        return;
      }

      this.messageElement.textContent = "Restaurando a tus Pokémon...";
      this.showDots();
      this.animateNextDot();
    });
  }

  public presentSuccess(payload: PokemonCenterHealedPayload): void {
    if (!this.active) {
      return;
    }

    this.pendingSuccess = payload;
    this.tryPresentSuccess();
  }

  public presentError(payload: PokemonCenterHealingErrorPayload): void {
    if (!this.active) {
      this.active = true;
      this.showPanel();
    }

    this.clearRuntimeEffects();
    this.active = true;
    this.hideDots();
    this.panel.classList.add("pokemon-center-healing-presentation__panel--error");
    this.messageElement.textContent = this.getErrorMessage(payload.code);
    this.schedulePanelClose(ERROR_MESSAGE_DURATION_MS);
  }

  public cancel(): void {
    this.clearRuntimeEffects();

    this.active = false;
    this.pendingSuccess = undefined;
    this.visualSequenceComplete = false;

    this.root.hidden = true;
    this.panel.classList.remove(
      "pokemon-center-healing-presentation__panel--visible",
      "pokemon-center-healing-presentation__panel--leaving",
      "pokemon-center-healing-presentation__panel--success",
      "pokemon-center-healing-presentation__panel--error"
    );

    this.resetDots();
  }

  public destroy(): void {
    this.cancel();
    this.root.remove();
  }

  private showPanel(): void {
    this.panel.classList.remove(
      "pokemon-center-healing-presentation__panel--visible",
      "pokemon-center-healing-presentation__panel--leaving",
      "pokemon-center-healing-presentation__panel--success",
      "pokemon-center-healing-presentation__panel--error"
    );

    this.root.hidden = false;

    requestAnimationFrame(() => {
      if (!this.active) {
        return;
      }

      this.panel.classList.add("pokemon-center-healing-presentation__panel--visible");
    });
  }

  private animateNextDot(): void {
    if (!this.active) {
      return;
    }

    const dot = this.statusDots[this.currentDotIndex];

    if (!dot) {
      this.completeDotSequence();
      return;
    }

    const stepNumber = this.currentDotIndex + 1;

    this.onHealingStep?.(stepNumber, this.statusDots.length);

    dot.classList.remove("pokemon-center-healing-presentation__dot--pulse");
    dot.classList.add("pokemon-center-healing-presentation__dot--active");

    void dot.offsetWidth;

    dot.classList.add("pokemon-center-healing-presentation__dot--pulse");

    this.currentDotIndex += 1;

    this.sequenceTimer = this.scene.time.delayedCall(DOT_STEP_DURATION_MS, () => {
      this.sequenceTimer = undefined;
      this.animateNextDot();
    });
  }

  private completeDotSequence(): void {
    if (!this.active) {
      return;
    }

    this.sequenceTimer = this.scene.time.delayedCall(
      ALL_DOTS_COMPLETE_DURATION_MS,
      () => {
        this.sequenceTimer = undefined;

        if (!this.active) {
          return;
        }

        this.visualSequenceComplete = true;
        this.pulseCompletedDots();
        this.tryPresentSuccess();
      }
    );
  }

  private tryPresentSuccess(): void {
    if (!this.active || !this.visualSequenceComplete || !this.pendingSuccess) {
      return;
    }

    const payload = this.pendingSuccess;
    this.pendingSuccess = undefined;

    this.onHealingSuccessReveal?.();

    this.messageElement.textContent =
      payload.restoredPokemonCount === 0
        ? "Tu equipo ya está completamente recuperado."
        : "¡Tus Pokémon están completamente recuperados!";

    this.pulseCompletedDots();
    this.playHealingCompletionFlash();

    this.panel.classList.remove("pokemon-center-healing-presentation__panel--success");
    void this.panel.offsetWidth;
    this.panel.classList.add("pokemon-center-healing-presentation__panel--success");

    this.schedulePanelClose(SUCCESS_MESSAGE_DURATION_MS);
  }

  private showDots(): void {
    for (const dot of this.statusDots) {
      dot.classList.add("pokemon-center-healing-presentation__dot--visible");
    }
  }

  private resetDots(): void {
    for (const dot of this.statusDots) {
      dot.classList.remove(
        "pokemon-center-healing-presentation__dot--visible",
        "pokemon-center-healing-presentation__dot--active",
        "pokemon-center-healing-presentation__dot--pulse"
      );
    }
  }

  private hideDots(): void {
    for (const dot of this.statusDots) {
      dot.classList.remove(
        "pokemon-center-healing-presentation__dot--visible",
        "pokemon-center-healing-presentation__dot--active",
        "pokemon-center-healing-presentation__dot--pulse"
      );
    }
  }

  private pulseCompletedDots(): void {
    this.statusDots.forEach((dot, index) => {
      dot.classList.add(
        "pokemon-center-healing-presentation__dot--visible",
        "pokemon-center-healing-presentation__dot--active"
      );

      dot.classList.remove("pokemon-center-healing-presentation__dot--pulse");
      void dot.offsetWidth;

      window.setTimeout(() => {
        if (!this.active) {
          return;
        }

        dot.classList.add("pokemon-center-healing-presentation__dot--pulse");
      }, index * 40);
    });
  }

  private playHealingCompletionFlash(): void {
    this.scene.cameras.main.flash(220, 255, 255, 255, false);
  }

  private schedulePanelClose(durationMs: number): void {
    this.finishTimer?.remove(false);

    this.finishTimer = this.scene.time.delayedCall(durationMs, () => {
      this.finishTimer = undefined;
      this.animatePanelOut();
    });
  }

  private animatePanelOut(): void {
    this.panelTransitionTimer?.remove(false);

    this.panel.classList.remove("pokemon-center-healing-presentation__panel--visible");
    this.panel.classList.add("pokemon-center-healing-presentation__panel--leaving");

    this.panelTransitionTimer = this.scene.time.delayedCall(PANEL_OUT_DURATION_MS, () => {
      this.panelTransitionTimer = undefined;

      this.active = false;
      this.root.hidden = true;

      this.panel.classList.remove(
        "pokemon-center-healing-presentation__panel--leaving",
        "pokemon-center-healing-presentation__panel--success",
        "pokemon-center-healing-presentation__panel--error"
      );

      this.resetDots();
    });
  }

  private clearRuntimeEffects(): void {
    this.sequenceTimer?.remove(false);
    this.sequenceTimer = undefined;

    this.finishTimer?.remove(false);
    this.finishTimer = undefined;

    this.panelTransitionTimer?.remove(false);
    this.panelTransitionTimer = undefined;
  }

  private getErrorMessage(code: PokemonCenterHealingErrorPayload["code"]): string {
    switch (code) {
      case "INVALID_INPUT":
        return "No se pudo iniciar la curación.";

      case "HEALING_NOT_AVAILABLE":
        return "Acércate al mostrador para usar el Centro Pokémon.";

      case "INCOMPATIBLE_STATE":
        return "No puedes usar el Centro Pokémon en este momento.";

      case "PERSISTENCE_CONFLICT":
        return "El estado de tu equipo cambió. Inténtalo nuevamente.";

      case "PERSISTENCE_FAILED":
        return "No se pudo guardar la curación. Inténtalo nuevamente.";
    }
  }
}
