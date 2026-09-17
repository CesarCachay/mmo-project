import type { PlayerInput } from "@cesar-mmo/shared";

import type { MovementInputSource } from "../input/MovementInputSource";

export class MovementInputController {
  private readonly inputSource: MovementInputSource;

  private lastInput: PlayerInput = {
    sequence: 0,
    up: false,
    down: false,
    left: false,
    right: false,
  };

  private inputSequence = 0;

  constructor(inputSource: MovementInputSource) {
    this.inputSource = inputSource;
  }

  public getCurrentInput(isBlocked: boolean): PlayerInput {
    if (isBlocked) {
      return this.createNeutralInput();
    }

    const state = this.inputSource.read();

    return {
      sequence: this.inputSequence,
      ...state,
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
