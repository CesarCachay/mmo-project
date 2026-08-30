import type {
  CreatePokemonWildEncounterSessionInput,
  PokemonWildEncounterSession,
} from './pokemon-wild-encounter-session';

export class PokemonWildEncounterSessionStore {
  private readonly sessionsByPlayerId = new Map<
    string,
    PokemonWildEncounterSession
  >();

  create(
    input: CreatePokemonWildEncounterSessionInput,
  ): PokemonWildEncounterSession {
    const existingSession = this.sessionsByPlayerId.get(input.playerId);

    if (existingSession) {
      throw new Error(
        `Player "${input.playerId}" already has an active wild encounter session "${existingSession.encounterId}"`,
      );
    }

    const session: PokemonWildEncounterSession = {
      encounterId: globalThis.crypto.randomUUID(),
      playerId: input.playerId,
      trainerId: input.trainerId,
      mapId: input.mapId,
      zoneId: input.zoneId,
      encounterTableId: input.encounterTableId,
      pokemon: input.pokemon,
      status: 'active',
    };

    this.sessionsByPlayerId.set(input.playerId, session);

    return session;
  }

  get(playerId: string): PokemonWildEncounterSession | undefined {
    return this.sessionsByPlayerId.get(playerId);
  }

  has(playerId: string): boolean {
    return this.sessionsByPlayerId.has(playerId);
  }

  remove(playerId: string): void {
    this.sessionsByPlayerId.delete(playerId);
  }

  clear(): void {
    this.sessionsByPlayerId.clear();
  }
}
