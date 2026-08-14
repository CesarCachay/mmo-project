import Phaser from "phaser";

export class DialogueBox {
  private readonly container: Phaser.GameObjects.Container;

  private readonly speakerText: Phaser.GameObjects.Text;

  private readonly dialogueText: Phaser.GameObjects.Text;

  private readonly hintText: Phaser.GameObjects.Text;

  private open = false;

  constructor(scene: Phaser.Scene) {
    const width = scene.scale.width;
    const height = scene.scale.height;

    const boxWidth = width - 32;
    const boxHeight = 90;

    const x = 16;
    const y = height - boxHeight - 16;

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

  show(speaker: string, dialogue: string) {
    this.speakerText.setText(speaker);
    this.dialogueText.setText(dialogue);

    this.container.setVisible(true);

    this.open = true;
  }

  hide() {
    this.container.setVisible(false);

    this.open = false;
  }

  isOpen() {
    return this.open;
  }
}
