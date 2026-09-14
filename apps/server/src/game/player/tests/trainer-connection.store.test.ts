import { beforeEach, describe, expect, it } from 'vitest';

import {
  TrainerAlreadyConnectedError,
  TrainerConnectionStore,
} from '../trainer-connection.store';

const TRAINER_ID = '22222222-2222-4222-8222-222222222222';

describe('TrainerConnectionStore', () => {
  let store: TrainerConnectionStore;

  beforeEach(() => {
    store = new TrainerConnectionStore();
  });

  it('binds a socket player to a Trainer', () => {
    store.bind('socket-1', TRAINER_ID);

    expect(store.getTrainerId('socket-1')).toBe(TRAINER_ID);
  });

  it('prevents two active sockets from using the same Trainer', () => {
    store.bind('socket-1', TRAINER_ID);

    expect(() => store.bind('socket-2', TRAINER_ID)).toThrow(
      TrainerAlreadyConnectedError,
    );
  });

  it('allows the Trainer to reconnect after unbind', () => {
    store.bind('socket-1', TRAINER_ID);

    store.unbind('socket-1');

    store.bind('socket-2', TRAINER_ID);

    expect(store.getTrainerId('socket-2')).toBe(TRAINER_ID);
  });
});
