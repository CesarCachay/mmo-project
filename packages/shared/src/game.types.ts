export type Player = {
  id: string;
  x: number;
  y: number;
  color: number;
};

export type PlayerInput = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
};
