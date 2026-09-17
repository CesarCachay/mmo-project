import { createNeutralMovementInputState } from "./MovementInputSource";

import type { MovementInputSource, MovementInputState } from "./MovementInputSource";

export class CompositeMovementInputSource implements MovementInputSource {
  private readonly sources: readonly MovementInputSource[];

  constructor(sources: readonly MovementInputSource[]) {
    this.sources = sources;
  }

  public read(): MovementInputState {
    const combined = createNeutralMovementInputState();

    for (const source of this.sources) {
      const state = source.read();

      combined.up ||= state.up;
      combined.down ||= state.down;
      combined.left ||= state.left;
      combined.right ||= state.right;
    }

    return combined;
  }
}
