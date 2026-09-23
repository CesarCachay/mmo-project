import type { MapId, PokemonTrainerBattleId } from '@cesar-mmo/shared';

export interface PokemonTrainerBattleStartAuthorization {
  readonly playerId: string;
  readonly mapId: MapId;
  readonly npcId: string;
  readonly trainerBattleId: PokemonTrainerBattleId;
  readonly expiresAt: number;
}

export interface AuthorizePokemonTrainerBattleStartInput {
  readonly playerId: string;
  readonly mapId: MapId;
  readonly npcId: string;
  readonly trainerBattleId: PokemonTrainerBattleId;
  readonly now?: number;
  readonly ttlMs?: number;
}

export interface ConsumePokemonTrainerBattleStartAuthorizationInput {
  readonly playerId: string;
  readonly mapId: MapId;
  readonly npcId: string;
  readonly trainerBattleId: PokemonTrainerBattleId;
  readonly now?: number;
}

const DEFAULT_AUTHORIZATION_TTL_MS = 10_000;

export class PokemonTrainerBattleStartAuthorizationStore {
  private readonly authorizations = new Map<
    string,
    PokemonTrainerBattleStartAuthorization
  >();

  public authorize(
    input: AuthorizePokemonTrainerBattleStartInput,
  ): PokemonTrainerBattleStartAuthorization {
    const now = input.now ?? Date.now();
    const ttlMs = input.ttlMs ?? DEFAULT_AUTHORIZATION_TTL_MS;

    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      throw new Error(`Trainer Battle authorization TTL must be positive`);
    }

    const authorization: PokemonTrainerBattleStartAuthorization = {
      playerId: input.playerId,
      mapId: input.mapId,
      npcId: input.npcId,
      trainerBattleId: input.trainerBattleId,
      expiresAt: now + ttlMs,
    };

    this.authorizations.set(input.playerId, authorization);
    return authorization;
  }

  public consume(
    playerId: string,
    npcId: string,
    now = Date.now(),
  ): PokemonTrainerBattleStartAuthorization | undefined {
    const authorization = this.authorizations.get(playerId);

    if (!authorization) {
      return undefined;
    }

    this.authorizations.delete(playerId);

    if (authorization.expiresAt < now) {
      return undefined;
    }

    if (authorization.npcId !== npcId) {
      return undefined;
    }

    return authorization;
  }

  /**
   * Consumes only when the full authoritative context still matches. A
   * mismatched/forged request does not burn a valid authorization; expired
   * authorizations are always removed.
   */
  public consumeExact(
    input: ConsumePokemonTrainerBattleStartAuthorizationInput,
  ): PokemonTrainerBattleStartAuthorization | undefined {
    const authorization = this.authorizations.get(input.playerId);

    if (!authorization) {
      return undefined;
    }

    const now = input.now ?? Date.now();

    if (authorization.expiresAt < now) {
      this.authorizations.delete(input.playerId);
      return undefined;
    }

    if (
      authorization.mapId !== input.mapId ||
      authorization.npcId !== input.npcId ||
      authorization.trainerBattleId !== input.trainerBattleId
    ) {
      return undefined;
    }

    this.authorizations.delete(input.playerId);
    return authorization;
  }

  public remove(playerId: string): void {
    this.authorizations.delete(playerId);
  }

  public clear(): void {
    this.authorizations.clear();
  }
}
