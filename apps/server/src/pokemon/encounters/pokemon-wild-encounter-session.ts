import type {
  MapId,
  PokemonEncounterTableId,
  PokemonInstance,
} from '@cesar-mmo/shared';

import type { PokemonTrainerId } from '../pokemon-trainer-identity';

export type PokemonWildEncounterSessionStatus = 'active';

export interface PokemonWildEncounterSession {
  readonly encounterId: string;
  readonly playerId: string;
  readonly trainerId: PokemonTrainerId;
  readonly mapId: MapId;
  readonly zoneId: string;
  readonly encounterTableId: PokemonEncounterTableId;
  readonly pokemon: PokemonInstance;
  readonly status: PokemonWildEncounterSessionStatus;
}

export type CreatePokemonWildEncounterSessionInput = {
  readonly playerId: string;
  readonly trainerId: PokemonTrainerId;
  readonly mapId: MapId;
  readonly zoneId: string;
  readonly encounterTableId: PokemonEncounterTableId;
  readonly pokemon: PokemonInstance;
};
