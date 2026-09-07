import type { MapId } from '@cesar-mmo/shared';

export interface PokemonStorageAccessSession {
  readonly playerId: string;
  readonly mapId: MapId;
  readonly terminalId: string;
}

export class PokemonStorageAccessSessionStore {
  private readonly sessions = new Map<string, PokemonStorageAccessSession>();

  start(
    playerId: string,
    mapId: MapId,
    terminalId: string,
  ): PokemonStorageAccessSession {
    const normalizedTerminalId = terminalId.trim();

    if (normalizedTerminalId.length === 0) {
      throw new Error('Storage terminal id cannot be empty');
    }

    const session: PokemonStorageAccessSession = {
      playerId,
      mapId,
      terminalId: normalizedTerminalId,
    };

    /* Sólo puede existir una sesión Storage activa por socket/player */
    this.sessions.set(playerId, session);

    return session;
  }

  get(playerId: string): PokemonStorageAccessSession | undefined {
    return this.sessions.get(playerId);
  }

  has(playerId: string): boolean {
    return this.sessions.has(playerId);
  }

  remove(playerId: string): void {
    this.sessions.delete(playerId);
  }

  clear(): void {
    this.sessions.clear();
  }
}
