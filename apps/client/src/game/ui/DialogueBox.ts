import Phaser from "phaser";

const DIALOGUE_MAX_WIDTH = 760;
const DIALOGUE_SIDE_MARGIN = 16;
const DIALOGUE_BOTTOM_MARGIN = 16;
const DIALOGUE_HEIGHT = 90;

export class DialogueBox {
  private readonly container: Phaser.GameObjects.Container;
  private readonly speakerText: Phaser.GameObjects.Text;
  private readonly dialogueText: Phaser.GameObjects.Text;
  private readonly hintText: Phaser.GameObjects.Text;

  private open = false;

  private currentSpeaker = "";
  private currentLines: readonly string[] = [];
  private currentLineIndex = 0;

  constructor(scene: Phaser.Scene) {
    const viewportWidth = scene.scale.width;
    const viewportHeight = scene.scale.height;

    const availableWidth = viewportWidth - DIALOGUE_SIDE_MARGIN * 2;

    const boxWidth = Math.min(availableWidth, DIALOGUE_MAX_WIDTH);

    const boxHeight = DIALOGUE_HEIGHT;

    const x = Math.round((viewportWidth - boxWidth) / 2);

    const y = viewportHeight - boxHeight - DIALOGUE_BOTTOM_MARGIN;

    const background = scene.add
      .rectangle(0, 0, boxWidth, boxHeight, 0x111111, 0.92)
      .setOrigin(0);

    background.setStrokeStyle(2, 0xffffff);

    this.speakerText = scene.add.text(12, 10, "", {
      fontFamily: "Arial",
      fontSize: "12px",
      color: "#ffffff",
      fontStyle: "bold",
    });

    this.dialogueText = scene.add.text(12, 32, "", {
      fontFamily: "Arial",
      fontSize: "11px",
      color: "#ffffff",
      wordWrap: {
        width: boxWidth - 24,
      },
    });

    this.hintText = scene.add
      .text(boxWidth - 10, boxHeight - 8, "E to close", {
        fontFamily: "Arial",
        fontSize: "9px",
        color: "#cccccc",
      })
      .setOrigin(1);

    this.container = scene.add.container(x, y, [
      background,
      this.speakerText,
      this.dialogueText,
      this.hintText,
    ]);

    this.container.setScrollFactor(0).setDepth(1000).setVisible(false);
  }

  start(speaker: string, lines: readonly string[]): void {
    if (lines.length === 0) {
      return;
    }

    this.currentSpeaker = speaker;
    this.currentLines = lines;
    this.currentLineIndex = 0;

    this.open = true;
    this.container.setVisible(true);

    this.renderCurrentLine();
  }

  advance(): void {
    if (!this.open) {
      return;
    }

    const isLastLine = this.currentLineIndex >= this.currentLines.length - 1;

    if (isLastLine) {
      this.hide();

      return;
    }

    this.currentLineIndex++;

    this.renderCurrentLine();
  }

  hide(): void {
    this.container.setVisible(false);

    this.open = false;

    this.currentSpeaker = "";
    this.currentLines = [];
    this.currentLineIndex = 0;
  }

  isOpen(): boolean {
    return this.open;
  }

  private renderCurrentLine(): void {
    const currentLine = this.currentLines[this.currentLineIndex];
    this.speakerText.setText(this.currentSpeaker);
    this.dialogueText.setText(currentLine);
    const isLastLine = this.currentLineIndex === this.currentLines.length - 1;
    this.hintText.setText(isLastLine ? "E to close" : "E to continue");
  }
}
