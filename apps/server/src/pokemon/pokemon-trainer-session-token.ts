import { createHash } from 'node:crypto';

import type { PokemonTrainerSessionToken } from './pokemon-trainer-identity';

export function hashPokemonTrainerSessionToken(
  sessionToken: PokemonTrainerSessionToken,
): string {
  return createHash('sha256').update(sessionToken, 'utf8').digest('hex');
}
