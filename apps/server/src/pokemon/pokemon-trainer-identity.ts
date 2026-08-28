export type PokemonTrainerId = string;
export type PokemonTrainerSessionToken = string;

export interface PokemonTrainerIdentity {
  trainerId: PokemonTrainerId;
  sessionToken: PokemonTrainerSessionToken;
}

export function createPokemonTrainerIdentity(): PokemonTrainerIdentity {
  return {
    trainerId: globalThis.crypto.randomUUID(),
    sessionToken: `pts_${globalThis.crypto.randomUUID()}`,
  };
}

export function isPokemonTrainerId(value: unknown): value is PokemonTrainerId {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

export function isPokemonTrainerSessionToken(
  value: unknown,
): value is PokemonTrainerSessionToken {
  return (
    typeof value === 'string' &&
    /^pts_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
