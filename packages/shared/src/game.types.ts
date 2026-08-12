export type Player = {
  id: string;
  x: number;
  y: number;
  color: number;
  lastProcessedInputSequence: number;
};

export type PlayerInput = {
  sequence: number;
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
};
