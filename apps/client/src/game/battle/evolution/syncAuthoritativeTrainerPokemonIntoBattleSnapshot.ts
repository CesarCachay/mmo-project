import type { BattleInstance, PokemonInstance } from "@cesar-mmo/shared";

export function syncAuthoritativeTrainerPokemonIntoBattleSnapshot(
  battle: BattleInstance,
  authoritativePokemon: PokemonInstance,
): BattleInstance {
  let battleChanged = false;

  const participants = battle.participants.map((participant) => {
    if (participant.type !== "trainer") {
      return participant;
    }

    let participantChanged = false;

    const pokemon = participant.pokemon.map((battlePokemon) => {
      if (
        battlePokemon.pokemon.instanceId !== authoritativePokemon.instanceId
      ) {
        return battlePokemon;
      }

      participantChanged = true;

      battleChanged = true;

      /*
       * IMPORTANT:
       *
       * Replace the persistent
       * PokemonInstance projection,
       * but preserve Battle runtime HP.
       */
      return {
        ...battlePokemon,
        pokemon: authoritativePokemon,
      };
    });

    if (!participantChanged) {
      return participant;
    }

    return {
      ...participant,
      pokemon,
    };
  });

  if (!battleChanged) {
    return battle;
  }

  return {
    ...battle,
    participants,
  };
}
