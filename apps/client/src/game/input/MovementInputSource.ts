export type MovementInputState = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
};

export interface MovementInputSource {
  read(): MovementInputState;
}

export function createNeutralMovementInputState(): MovementInputState {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
  };
}
