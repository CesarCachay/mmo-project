import type { MapId, PokemonShopCatalogId } from '@cesar-mmo/shared';

export interface PokemonShopAccessSession {
  readonly sessionId: string;
  readonly playerId: string;
  readonly mapId: MapId;
  readonly npcId: string;
  readonly catalogId: PokemonShopCatalogId;
}

export class PokemonShopAccessSessionStore {
  private readonly sessionsByPlayerId = new Map<
    string,
    PokemonShopAccessSession
  >();

  start(input: {
    readonly playerId: string;
    readonly mapId: MapId;
    readonly npcId: string;
    readonly catalogId: PokemonShopCatalogId;
  }): PokemonShopAccessSession {
    const existing = this.sessionsByPlayerId.get(input.playerId);

    if (existing) {
      if (
        existing.mapId === input.mapId &&
        existing.npcId === input.npcId &&
        existing.catalogId === input.catalogId
      ) {
        return existing;
      }

      throw new Error(
        `Player "${input.playerId}" already has an active shop session`,
      );
    }

    const session: PokemonShopAccessSession = {
      sessionId: globalThis.crypto.randomUUID(),
      playerId: input.playerId,
      mapId: input.mapId,
      npcId: input.npcId.trim(),
      catalogId: input.catalogId,
    };

    this.sessionsByPlayerId.set(input.playerId, session);

    return session;
  }

  get(playerId: string): PokemonShopAccessSession | undefined {
    return this.sessionsByPlayerId.get(playerId);
  }

  has(playerId: string): boolean {
    return this.sessionsByPlayerId.has(playerId);
  }

  remove(playerId: string): PokemonShopAccessSession | undefined {
    const session = this.sessionsByPlayerId.get(playerId);
    this.sessionsByPlayerId.delete(playerId);
    return session;
  }

  clear(): void {
    this.sessionsByPlayerId.clear();
  }
}
