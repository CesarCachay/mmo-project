import { createNeutralMovementInputState } from "./MovementInputSource";

import type { MovementInputSource, MovementInputState } from "./MovementInputSource";

export class TouchMovementInputSource implements MovementInputSource {
  private state: MovementInputState = createNeutralMovementInputState();

  public read(): MovementInputState {
    return {
      ...this.state,
    };
  }

  public setState(state: MovementInputState): void {
    this.state = {
      ...state,
    };
  }

  public reset(): void {
    this.state = createNeutralMovementInputState();
  }
}
