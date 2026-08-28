const POKEMON_TRAINER_SESSION_TOKEN_KEY = "cesar-mmo:pokemon-trainer-session-token";

export function getPokemonTrainerSessionToken(): string | undefined {
  try {
    return window.localStorage.getItem(POKEMON_TRAINER_SESSION_TOKEN_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function setPokemonTrainerSessionToken(sessionToken: string): void {
  try {
    window.localStorage.setItem(POKEMON_TRAINER_SESSION_TOKEN_KEY, sessionToken);
  } catch {
    // Local storage unavailable.
  }
}
