import type { GameAction, GameActionInputSource } from "./GameActionInputSource";

export class CompositeActionInputSource implements GameActionInputSource {
  private readonly sources: readonly GameActionInputSource[];

  constructor(sources: readonly GameActionInputSource[]) {
    this.sources = sources;
  }

  public consume(action: GameAction): boolean {
    let pressed = false;

    for (const source of this.sources) {
      if (source.consume(action)) {
        pressed = true;
      }
    }

    return pressed;
  }
}
