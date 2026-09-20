import type {
  BattleMoveVfxRenderer,
  BattleMoveVfxRequest,
} from "./battle-move-vfx.types";
import { getBattleMoveVfxDefinition } from "./move-vfx.registry";

export class BattleMoveVfxController {
  private readonly renderer: BattleMoveVfxRenderer;

  constructor(renderer: BattleMoveVfxRenderer) {
    this.renderer = renderer;
  }

  public play(request: BattleMoveVfxRequest): Promise<void> {
    const definition = getBattleMoveVfxDefinition(request.moveId);

    if (!definition) {
      return Promise.resolve();
    }

    return this.renderer.play({
      ...request,
      definition,
    });
  }

  public clear(): void {
    this.renderer.clear();
  }
}
