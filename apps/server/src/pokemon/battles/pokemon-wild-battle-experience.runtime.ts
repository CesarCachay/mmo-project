import {
  calculateWildBattleExperienceReward,
  distributePokemonPartyExperience,
  getPokemonSpecies,
} from '@cesar-mmo/shared';

import type { PokemonPartyExperienceDistribution } from '@cesar-mmo/shared';

import type { PokemonTrainerId } from '../pokemon-trainer-identity';

import {
  getPokemonBattleParticipatingPokemonInstanceIds,
  type PokemonBattleSession,
} from './pokemon-battle-session.js';

export interface PokemonWildBattleExperiencePlan {
  readonly battleId: string;
  readonly trainerId: PokemonTrainerId;
  readonly trainerParticipantId: string;
  readonly defeatedWildPokemonInstanceId: string;
  readonly defeatedWildSpeciesId: number;
  readonly defeatedWildLevel: number;
  readonly baseExperienceReward: number;
  readonly distribution: PokemonPartyExperienceDistribution;
}

export function planPokemonWildBattleExperience(
  session: PokemonBattleSession,
): PokemonWildBattleExperiencePlan {
  /* Wild Battle V1 currently supports one Trainer */
  if (session.trainerBindings.length !== 1) {
    throw new Error(
      `Wild battle "${session.battle.battleId}" must contain exactly one Trainer binding`,
    );
  }

  const trainerBinding = session.trainerBindings[0];

  if (!trainerBinding) {
    throw new Error(
      `Trainer binding not found in wild battle "${session.battle.battleId}"`,
    );
  }

  const trainerParticipant = session.battle.participants.find(
    (participant) => participant.id === trainerBinding.participantId,
  );

  if (!trainerParticipant || trainerParticipant.type !== 'trainer') {
    throw new Error(
      `Trainer participant "${trainerBinding.participantId}" not found in wild battle "${session.battle.battleId}"`,
    );
  }

  const wildParticipant = session.battle.participants.find(
    (participant) => participant.type === 'wild',
  );

  if (!wildParticipant) {
    throw new Error(
      `Wild participant not found in battle "${session.battle.battleId}"`,
    );
  }

  const wildPokemonState =
    wildParticipant.pokemon[wildParticipant.activePokemonIndex];

  if (!wildPokemonState) {
    throw new Error(
      `Wild active Pokémon not found in battle "${session.battle.battleId}"`,
    );
  }

  /* EXP may only be planned after defeating the Wild Pokémon */
  if (wildPokemonState.currentHp > 0) {
    throw new Error(
      `Cannot reward EXP while Wild Pokémon "${wildPokemonState.pokemon.instanceId}" is still alive`,
    );
  }

  const species = getPokemonSpecies(wildPokemonState.pokemon.speciesId);

  if (!species) {
    throw new Error(
      `Pokémon species "${wildPokemonState.pokemon.speciesId}" not found`,
    );
  }

  /* Battle EXP requires a valid baseExperience */
  if (
    species.baseExperience === null ||
    !Number.isInteger(species.baseExperience) ||
    species.baseExperience <= 0
  ) {
    throw new Error(
      [
        `Pokémon species "${species.id}"`,
        `("${species.name}")`,
        'does not have a valid baseExperience',
        `for battle EXP: "${String(species.baseExperience)}"`,
      ].join(' '),
    );
  }

  const reward = calculateWildBattleExperienceReward({
    baseExperience: species.baseExperience,
    defeatedPokemonLevel: wildPokemonState.pokemon.level,
  });

  /* BattlePokemonState.currentHp is authoritative at Battle completion */
  const partySnapshot = trainerParticipant.pokemon.map((pokemonState) => ({
    pokemonInstanceId: pokemonState.pokemon.instanceId,
    level: pokemonState.pokemon.level,
    currentHp: pokemonState.currentHp,
  }));

  const participatingPokemonInstanceIds =
    getPokemonBattleParticipatingPokemonInstanceIds(
      session,
      trainerParticipant.id,
    );

  const distribution = distributePokemonPartyExperience({
    baseExperienceReward: reward.experience,
    pokemon: partySnapshot,
    participatingPokemonInstanceIds,
  });

  return {
    battleId: session.battle.battleId,
    trainerId: trainerBinding.trainerId,
    trainerParticipantId: trainerParticipant.id,
    defeatedWildPokemonInstanceId: wildPokemonState.pokemon.instanceId,
    defeatedWildSpeciesId: wildPokemonState.pokemon.speciesId,
    defeatedWildLevel: wildPokemonState.pokemon.level,
    baseExperienceReward: reward.experience,
    distribution,
  };
}
