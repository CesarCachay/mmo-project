import Phaser from "phaser";

import type { PlayerInput } from "@cesar-mmo/shared";

export class MovementInputController {
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys;

  private readonly wasd: Record<
    "up" | "down" | "left" | "right",
    Phaser.Input.Keyboard.Key
  >;

  private lastInput: PlayerInput = {
    sequence: 0,
    up: false,
    down: false,
    left: false,
    right: false,
  };

  private inputSequence = 0;

  constructor(keyboard: Phaser.Input.Keyboard.KeyboardPlugin) {
    this.cursors = keyboard.createCursorKeys();

    this.wasd = keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as Record<"up" | "down" | "left" | "right", Phaser.Input.Keyboard.Key>;
  }

  public getCurrentInput(isBlocked: boolean): PlayerInput {
    if (isBlocked) {
      return this.createNeutralInput();
    }

    return {
      sequence: this.inputSequence,
      left: this.cursors.left.isDown || this.wasd.left.isDown,
      right: this.cursors.right.isDown || this.wasd.right.isDown,
      up: this.cursors.up.isDown || this.wasd.up.isDown,
      down: this.cursors.down.isDown || this.wasd.down.isDown,
    };
  }

  public getChangedInput(input: PlayerInput): PlayerInput | undefined {
    if (!this.hasInputChanged(input)) {
      return undefined;
    }

    this.inputSequence++;

    const inputToSend: PlayerInput = {
      ...input,
      sequence: this.inputSequence,
    };

    this.lastInput = inputToSend;

    return inputToSend;
  }

  public resetLastInputToNeutral(): void {
    this.lastInput = this.createNeutralInput();
  }

  private createNeutralInput(): PlayerInput {
    return {
      sequence: this.inputSequence,
      up: false,
      down: false,
      left: false,
      right: false,
    };
  }

  private hasInputChanged(input: PlayerInput): boolean {
    return (
      input.up !== this.lastInput.up ||
      input.down !== this.lastInput.down ||
      input.left !== this.lastInput.left ||
      input.right !== this.lastInput.right
    );
  }
}
