import { describe, expect, it } from 'vitest';

import { PokemonTrainerBattleStartAuthorizationStore } from '../pokemon-trainer-battle-start-authorization.store';

describe('PokemonTrainerBattleStartAuthorizationStore', () => {
  it('consumes a valid authorization only once', () => {
    const store = new PokemonTrainerBattleStartAuthorizationStore();

    store.authorize({
      playerId: 'player-a',
      mapId: 'route-01',
      npcId: 'studentGary',
      trainerBattleId: 'student-gary',
      now: 1_000,
      ttlMs: 5_000,
    });

    expect(store.consume('player-a', 'studentGary', 2_000)).toMatchObject({
      playerId: 'player-a',
      mapId: 'route-01',
      npcId: 'studentGary',
      trainerBattleId: 'student-gary',
    });

    expect(store.consume('player-a', 'studentGary', 2_001)).toBeUndefined();
  });

  it('rejects an expired or mismatched authorization', () => {
    const store = new PokemonTrainerBattleStartAuthorizationStore();

    store.authorize({
      playerId: 'player-a',
      mapId: 'route-01',
      npcId: 'studentGary',
      trainerBattleId: 'student-gary',
      now: 1_000,
      ttlMs: 100,
    });

    expect(store.consume('player-a', 'studentGary', 1_101)).toBeUndefined();

    store.authorize({
      playerId: 'player-a',
      mapId: 'route-01',
      npcId: 'studentGary',
      trainerBattleId: 'student-gary',
      now: 2_000,
      ttlMs: 1_000,
    });

    expect(
      store.consume('player-a', 'studentFrancisca', 2_100),
    ).toBeUndefined();
  });

  it('does not burn a valid authorization when an exact-context request is mismatched', () => {
    const store = new PokemonTrainerBattleStartAuthorizationStore();

    store.authorize({
      playerId: 'player-a',
      mapId: 'gym-01',
      npcId: 'gymLeaderBrock',
      trainerBattleId: 'gym-leader-brock',
      now: 1_000,
      ttlMs: 5_000,
    });

    expect(
      store.consumeExact({
        playerId: 'player-a',
        mapId: 'gym-01',
        npcId: 'studentGary',
        trainerBattleId: 'student-gary',
        now: 1_500,
      }),
    ).toBeUndefined();

    expect(
      store.consumeExact({
        playerId: 'player-a',
        mapId: 'gym-01',
        npcId: 'gymLeaderBrock',
        trainerBattleId: 'gym-leader-brock',
        now: 1_501,
      }),
    ).toMatchObject({
      playerId: 'player-a',
      mapId: 'gym-01',
      npcId: 'gymLeaderBrock',
      trainerBattleId: 'gym-leader-brock',
    });

    expect(
      store.consumeExact({
        playerId: 'player-a',
        mapId: 'gym-01',
        npcId: 'gymLeaderBrock',
        trainerBattleId: 'gym-leader-brock',
        now: 1_502,
      }),
    ).toBeUndefined();
  });

  it('expires an exact-context authorization and removes it', () => {
    const store = new PokemonTrainerBattleStartAuthorizationStore();

    store.authorize({
      playerId: 'player-a',
      mapId: 'gym-01',
      npcId: 'gymLeaderBrock',
      trainerBattleId: 'gym-leader-brock',
      now: 5_000,
      ttlMs: 100,
    });

    expect(
      store.consumeExact({
        playerId: 'player-a',
        mapId: 'gym-01',
        npcId: 'gymLeaderBrock',
        trainerBattleId: 'gym-leader-brock',
        now: 5_101,
      }),
    ).toBeUndefined();

    expect(
      store.consumeExact({
        playerId: 'player-a',
        mapId: 'gym-01',
        npcId: 'gymLeaderBrock',
        trainerBattleId: 'gym-leader-brock',
        now: 5_102,
      }),
    ).toBeUndefined();
  });
});
