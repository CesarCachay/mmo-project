import {
  createBattleParticipant,
  createBattlePokemonState,
} from '@cesar-mmo/shared';

import type { BattleInstance, PokemonInstance } from '@cesar-mmo/shared';
import { PokemonWildEncounterSession } from '../encounters/pokemon-wild-encounter-session';

export interface CreateWildBattleInstanceInput {
  readonly encounterSession: PokemonWildEncounterSession;
  readonly trainerPokemon: readonly PokemonInstance[];
}

export function createWildBattleInstance(
  input: CreateWildBattleInstanceInput,
): BattleInstance {
  const { encounterSession, trainerPokemon } = input;

  if (trainerPokemon.length === 0) {
    throw new Error(
      `Cannot create wild battle for trainer "${encounterSession.trainerId}" without Pokémon`,
    );
  }

  const trainerBattlePokemon = trainerPokemon.map((pokemon) =>
    createBattlePokemonState(pokemon),
  );

  const initialActivePokemonIndex = trainerBattlePokemon.findIndex(
    (pokemonState) => pokemonState.currentHp > 0,
  );

  if (initialActivePokemonIndex === -1) {
    throw new Error(
      `Cannot create wild battle for trainer "${encounterSession.trainerId}" because all Trainer Pokémon are fainted`,
    );
  }

  const wildBattlePokemon = createBattlePokemonState(encounterSession.pokemon);

  const trainerParticipant = createBattleParticipant({
    id: globalThis.crypto.randomUUID(),
    type: 'trainer',
    side: 'side-a',
    pokemon: trainerBattlePokemon,
    activePokemonIndex: initialActivePokemonIndex,
  });

  const wildParticipant = createBattleParticipant({
    id: globalThis.crypto.randomUUID(),
    type: 'wild',
    side: 'side-b',
    pokemon: [wildBattlePokemon],
    activePokemonIndex: 0,
  });

  return {
    battleId: globalThis.crypto.randomUUID(),
    type: 'wild',
    status: 'active',
    participants: [trainerParticipant, wildParticipant],
  };
}
