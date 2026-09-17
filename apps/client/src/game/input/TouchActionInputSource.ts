import type { GameAction, GameActionInputSource } from "./GameActionInputSource";

export class TouchActionInputSource implements GameActionInputSource {
  private readonly pendingActions = new Set<GameAction>();

  public trigger(action: GameAction): void {
    this.pendingActions.add(action);
  }

  public consume(action: GameAction): boolean {
    return this.pendingActions.delete(action);
  }

  public reset(): void {
    this.pendingActions.clear();
  }
}
