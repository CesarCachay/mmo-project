import Phaser from "phaser";

import type {
  PokemonCenterHealedPayload,
  PokemonCenterHealingErrorPayload,
} from "@cesar-mmo/shared";

const INTRO_DURATION_MS = 350;
const DOT_STEP_DURATION_MS = 180;
const ALL_DOTS_COMPLETE_DURATION_MS = 300;

const SUCCESS_MESSAGE_DURATION_MS = 1200;
const ERROR_MESSAGE_DURATION_MS = 1500;

const PANEL_IN_DURATION_MS = 180;
const PANEL_OUT_DURATION_MS = 170;

export interface PokemonCenterHealingPresentationControllerOptions {
  readonly onHealingStep?: (stepNumber: number, totalSteps: number) => void;
  readonly onHealingSuccessReveal?: () => void;
}

export class PokemonCenterHealingPresentationController {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly messageText: Phaser.GameObjects.Text;
  private readonly statusDots: Phaser.GameObjects.Arc[];

  private readonly onHealingStep?: PokemonCenterHealingPresentationControllerOptions["onHealingStep"];
  private readonly onHealingSuccessReveal?: PokemonCenterHealingPresentationControllerOptions["onHealingSuccessReveal"];

  private sequenceTimer?: Phaser.Time.TimerEvent;
  private finishTimer?: Phaser.Time.TimerEvent;

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

    const boxWidth = Math.min(scene.scale.width - 40, 360);

    const boxHeight = 100;

    const background = scene.add
      .rectangle(0, 0, boxWidth, boxHeight, 0x111827, 0.98)
      .setStrokeStyle(2, 0xffffff, 1);

    const header = scene.add.rectangle(
      0,
      -boxHeight / 2 + 11,
      boxWidth - 4,
      20,
      0xb4232c,
      1
    );

    const titleText = scene.add
      .text(0, -boxHeight / 2 + 11, "CENTRO POKÉMON", {
        fontFamily: "Arial",
        fontSize: "11px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.messageText = scene.add
      .text(0, -14, "", {
        fontFamily: "Arial",
        fontSize: "11px",
        color: "#ffffff",
        align: "center",

        wordWrap: {
          width: boxWidth - 30,
        },
      })
      .setOrigin(0.5);

    const dotCount = 6;
    const spacing = 22;

    const startX = -((dotCount - 1) * spacing) / 2;

    this.statusDots = Array.from(
      {
        length: dotCount,
      },
      (_, index) => {
        return scene.add
          .circle(startX + index * spacing, 20, 6, 0x374151, 1)
          .setStrokeStyle(2, 0xffffff, 0.8)
          .setVisible(false);
      }
    );

    this.container = scene.add.container(
      scene.scale.width / 2,
      scene.scale.height - 105,
      [background, header, titleText, this.messageText, ...this.statusDots]
    );

    this.container
      .setScrollFactor(0)
      .setDepth(2300)
      .setVisible(false)
      .setAlpha(0)
      .setScale(0.92);
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

    this.messageText.setText("Un momento, por favor...");

    this.container.setVisible(true).setAlpha(0).setScale(0.92);

    this.animatePanelIn();

    /*
     * La animación ahora tiene su propio timeline.
     * No depende de cuándo responda el backend.
     */
    this.sequenceTimer = this.scene.time.delayedCall(INTRO_DURATION_MS, () => {
      this.sequenceTimer = undefined;

      if (!this.active) {
        return;
      }

      this.messageText.setText("Restaurando a tus Pokémon...");

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
      this.container.setVisible(true).setAlpha(1).setScale(1);
    }

    this.clearRuntimeEffects();
    this.active = true;
    this.hideDots();
    this.messageText.setText(this.getErrorMessage(payload.code));
    this.schedulePanelClose(ERROR_MESSAGE_DURATION_MS);
  }

  public cancel(): void {
    this.clearRuntimeEffects();
    this.active = false;
    this.pendingSuccess = undefined;
    this.visualSequenceComplete = false;
    this.container.setVisible(false).setAlpha(0).setScale(0.92);
    this.resetDots();
  }

  public destroy(): void {
    this.cancel();
    this.container.destroy(true);
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

    dot.setVisible(true).setFillStyle(0xf8fafc, 1).setAlpha(1).setScale(0.7);

    this.scene.tweens.killTweensOf(dot);

    this.scene.tweens.add({
      targets: dot,
      scaleX: 1.45,
      scaleY: 1.45,
      duration: 90,
      ease: "Back.easeOut",
      onComplete: () => {
        this.scene.tweens.add({
          targets: dot,
          scaleX: 1,
          scaleY: 1,
          duration: 90,
          ease: "Quad.easeInOut",
        });
      },
    });

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

    /*
     * Los seis indicadores permanecen encendidos
     * durante una pausa visible.
     */
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

    if (payload.restoredPokemonCount === 0) {
      this.messageText.setText("Tu equipo ya está completamente recuperado.");
    } else {
      this.messageText.setText("¡Tus Pokémon están completamente recuperados!");
    }

    this.pulseCompletedDots();

    this.playHealingCompletionFlash();

    this.scene.tweens.killTweensOf(this.container);

    this.scene.tweens.add({
      targets: this.container,
      scaleX: 1.045,
      scaleY: 1.045,
      duration: 140,
      yoyo: true,
      ease: "Quad.easeOut",
    });

    this.schedulePanelClose(SUCCESS_MESSAGE_DURATION_MS);
  }

  private showDots(): void {
    for (const dot of this.statusDots) {
      dot.setVisible(true).setFillStyle(0x374151, 1).setAlpha(0.55).setScale(0.9);
    }
  }

  private resetDots(): void {
    for (const dot of this.statusDots) {
      this.scene.tweens.killTweensOf(dot);

      dot.setVisible(false).setFillStyle(0x374151, 1).setAlpha(1).setScale(1);
    }
  }

  private hideDots(): void {
    for (const dot of this.statusDots) {
      this.scene.tweens.killTweensOf(dot);

      dot.setVisible(false);
    }
  }

  private pulseCompletedDots(): void {
    this.statusDots.forEach((dot, index) => {
      dot.setVisible(true).setFillStyle(0xf8fafc, 1).setAlpha(1).setScale(1);

      this.scene.tweens.killTweensOf(dot);

      this.scene.tweens.add({
        targets: dot,
        scaleX: 1.25,
        scaleY: 1.25,
        duration: 100,
        delay: index * 40,
        yoyo: true,
        ease: "Quad.easeOut",
      });
    });
  }

  private playHealingCompletionFlash(): void {
    const camera = this.scene.cameras.main;
    camera.flash(220, 255, 255, 255, false);
  }

  private animatePanelIn(): void {
    this.scene.tweens.killTweensOf(this.container);

    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: PANEL_IN_DURATION_MS,
      ease: "Back.easeOut",
    });
  }

  private animatePanelOut(onComplete: () => void): void {
    this.scene.tweens.killTweensOf(this.container);

    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      scaleX: 0.96,
      scaleY: 0.96,
      duration: PANEL_OUT_DURATION_MS,
      ease: "Quad.easeIn",
      onComplete,
    });
  }

  private schedulePanelClose(durationMs: number): void {
    this.finishTimer?.remove(false);

    this.finishTimer = this.scene.time.delayedCall(durationMs, () => {
      this.finishTimer = undefined;

      this.animatePanelOut(() => {
        this.active = false;
        this.container.setVisible(false).setScale(0.92);
        this.resetDots();
      });
    });
  }

  private clearRuntimeEffects(): void {
    this.sequenceTimer?.remove(false);
    this.sequenceTimer = undefined;
    this.finishTimer?.remove(false);
    this.finishTimer = undefined;

    this.scene.tweens.killTweensOf(this.container);

    for (const dot of this.statusDots) {
      this.scene.tweens.killTweensOf(dot);
    }
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
