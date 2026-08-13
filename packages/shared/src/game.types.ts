export type Player = {
  id: string;
  x: number;
  y: number;
  color: number;
  direction: Direction;
  isMoving: boolean;
  lastProcessedInputSequence: number;
};

export type PlayerInput = {
  sequence: number;
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
};

export type Direction = "up" | "down" | "left" | "right";
