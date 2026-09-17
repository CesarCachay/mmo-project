export type GameAction = "interact";

export interface GameActionInputSource {
  consume(action: GameAction): boolean;
}
