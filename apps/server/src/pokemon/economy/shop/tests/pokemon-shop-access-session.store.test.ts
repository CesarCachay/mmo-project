import { describe, expect, it } from 'vitest';

import { PokemonShopAccessSessionStore } from '../pokemon-shop-access-session.store';

describe('PokemonShopAccessSessionStore', () => {
  it('keeps duplicate open requests idempotent for the same shop', () => {
    const store = new PokemonShopAccessSessionStore();

    const first = store.start({
      playerId: 'player-1',
      mapId: 'poke-shop',
      npcId: 'shopClerk',
      catalogId: 'standard-poke-shop-v1',
    });

    const second = store.start({
      playerId: 'player-1',
      mapId: 'poke-shop',
      npcId: 'shopClerk',
      catalogId: 'standard-poke-shop-v1',
    });

    expect(second.sessionId).toBe(first.sessionId);
  });

  it('rejects a different shop while one is active', () => {
    const store = new PokemonShopAccessSessionStore();

    store.start({
      playerId: 'player-1',
      mapId: 'poke-shop',
      npcId: 'shopClerk',
      catalogId: 'standard-poke-shop-v1',
    });

    expect(() =>
      store.start({
        playerId: 'player-1',
        mapId: 'poke-shop',
        npcId: 'otherClerk',
        catalogId: 'standard-poke-shop-v1',
      }),
    ).toThrow(/active shop session/i);
  });

  it('returns the removed session when closing', () => {
    const store = new PokemonShopAccessSessionStore();
    const session = store.start({
      playerId: 'player-1',
      mapId: 'poke-shop',
      npcId: 'shopClerk',
      catalogId: 'standard-poke-shop-v1',
    });

    expect(store.remove('player-1')).toEqual(session);
    expect(store.has('player-1')).toBe(false);
  });
});
