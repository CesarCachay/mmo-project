import {
  createPokemonTrainerIdentity,
  type PokemonTrainerIdentity,
  type PokemonTrainerId,
  type PokemonTrainerSessionToken,
} from './pokemon-trainer-identity';

export interface PokemonTrainerIdentityResolution {
  identity: PokemonTrainerIdentity;
  restored: boolean;
}

export class PokemonTrainerIdentityStore {
  private readonly identitiesByPlayerId = new Map<
    string,
    PokemonTrainerIdentity
  >();

  private readonly identitiesBySessionToken = new Map<
    PokemonTrainerSessionToken,
    PokemonTrainerIdentity
  >();

  private readonly activePlayerIdByTrainerId = new Map<
    PokemonTrainerId,
    string
  >();

  resolve(
    playerId: string,
    sessionToken?: PokemonTrainerSessionToken,
  ): PokemonTrainerIdentityResolution {
    const normalizedPlayerId = playerId.trim();

    if (!normalizedPlayerId) {
      throw new Error('Player id is required to resolve a trainer identity');
    }

    if (this.identitiesByPlayerId.has(normalizedPlayerId)) {
      throw new Error(
        `Player ${normalizedPlayerId} already has an active trainer identity`,
      );
    }

    if (sessionToken) {
      const existingIdentity = this.identitiesBySessionToken.get(sessionToken);

      if (existingIdentity) {
        this.bind(normalizedPlayerId, existingIdentity);

        return {
          identity: existingIdentity,
          restored: true,
        };
      }
    }

    const identity = createPokemonTrainerIdentity();

    this.identitiesBySessionToken.set(identity.sessionToken, identity);

    this.bind(normalizedPlayerId, identity);

    return {
      identity,
      restored: false,
    };
  }

  get(playerId: string): PokemonTrainerIdentity | undefined {
    return this.identitiesByPlayerId.get(playerId);
  }

  has(playerId: string): boolean {
    return this.identitiesByPlayerId.has(playerId);
  }

  unbind(playerId: string): void {
    const identity = this.identitiesByPlayerId.get(playerId);

    if (!identity) {
      return;
    }

    this.identitiesByPlayerId.delete(playerId);

    const activePlayerId = this.activePlayerIdByTrainerId.get(
      identity.trainerId,
    );

    if (activePlayerId === playerId) {
      this.activePlayerIdByTrainerId.delete(identity.trainerId);
    }
  }

  clear(): void {
    this.identitiesByPlayerId.clear();
    this.identitiesBySessionToken.clear();
    this.activePlayerIdByTrainerId.clear();
  }

  private bind(playerId: string, identity: PokemonTrainerIdentity): void {
    const activePlayerId = this.activePlayerIdByTrainerId.get(
      identity.trainerId,
    );

    if (activePlayerId && activePlayerId !== playerId) {
      throw new Error(`Trainer ${identity.trainerId} is already connected`);
    }

    this.identitiesByPlayerId.set(playerId, identity);

    this.activePlayerIdByTrainerId.set(identity.trainerId, playerId);
  }

  bindRecovered(
    playerId: string,
    identity: PokemonTrainerIdentity,
  ): PokemonTrainerIdentity {
    const normalizedPlayerId = playerId.trim();

    if (!normalizedPlayerId) {
      throw new Error(
        'Player id is required to bind a recovered trainer identity',
      );
    }

    if (this.identitiesByPlayerId.has(normalizedPlayerId)) {
      throw new Error(
        `Player ${normalizedPlayerId} already has an active trainer identity`,
      );
    }

    const identityForSessionToken = this.identitiesBySessionToken.get(
      identity.sessionToken,
    );

    if (
      identityForSessionToken &&
      identityForSessionToken.trainerId !== identity.trainerId
    ) {
      throw new Error(
        'Trainer session token is already bound to another trainer',
      );
    }

    this.bind(normalizedPlayerId, identity);
    this.identitiesBySessionToken.set(identity.sessionToken, identity);

    return identity;
  }
}
