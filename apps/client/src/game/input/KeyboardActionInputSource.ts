import Phaser from "phaser";

import type { GameAction, GameActionInputSource } from "./GameActionInputSource";

export class KeyboardActionInputSource implements GameActionInputSource {
  private readonly interactKey: Phaser.Input.Keyboard.Key;

  constructor(keyboard: Phaser.Input.Keyboard.KeyboardPlugin) {
    this.interactKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
  }

  public consume(action: GameAction): boolean {
    switch (action) {
      case "interact":
        return Phaser.Input.Keyboard.JustDown(this.interactKey);
    }
  }
}
