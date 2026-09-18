import Phaser from "phaser";

import { GameViewportOverlay } from "../../shell/GameViewportOverlay";

export class DialogueBox {
  private readonly overlay: GameViewportOverlay;
  private readonly root: HTMLDivElement;
  private readonly speakerElement: HTMLDivElement;
  private readonly dialogueElement: HTMLDivElement;
  private readonly hintElement: HTMLDivElement;

  private open = false;

  constructor(scene: Phaser.Scene) {
    this.overlay = new GameViewportOverlay("dialogue-overlay");

    this.root = document.createElement("div");
    this.root.className = "dialogue-box";
    this.root.setAttribute("role", "status");
    this.root.setAttribute("aria-live", "polite");

    this.speakerElement = document.createElement("div");
    this.speakerElement.className = "dialogue-box__speaker";
    this.dialogueElement = document.createElement("div");
    this.dialogueElement.className = "dialogue-box__text";
    this.hintElement = document.createElement("div");
    this.hintElement.className = "dialogue-box__hint";

    this.root.append(this.speakerElement, this.dialogueElement, this.hintElement);
    this.overlay.mount(this.root);
    this.overlay.setVisible(false);

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.destroy();
    });
  }

  public showLine(speaker: string, line: string, isLastLine: boolean): void {
    this.speakerElement.textContent = speaker;
    this.dialogueElement.textContent = line;
    const actionKey = this.getActionKeyLabel();

    this.hintElement.textContent = isLastLine
      ? `${actionKey} · Cerrar`
      : `${actionKey} · Continuar`;

    this.open = true;
    this.overlay.setVisible(true);
  }

  public hide(): void {
    this.open = false;

    this.overlay.setVisible(false);
    this.speakerElement.textContent = "";
    this.dialogueElement.textContent = "";
    this.hintElement.textContent = "";
  }

  public isOpen(): boolean {
    return this.open;
  }

  public destroy(): void {
    this.overlay.destroy();

    this.open = false;
  }

  private getActionKeyLabel(): string {
    const isTouchPrimary = window.matchMedia(
      "(hover: none) and (pointer: coarse)"
    ).matches;

    return isTouchPrimary ? "A" : "E";
  }
}
