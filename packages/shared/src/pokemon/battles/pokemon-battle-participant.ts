import type {
  BattleParticipant,
  BattleParticipantId,
  BattleParticipantType,
  BattlePokemonState,
  BattleSide,
} from "./pokemon-battle.types.js";

export interface CreateBattleParticipantInput {
  readonly id: BattleParticipantId;
  readonly type: BattleParticipantType;
  readonly side: BattleSide;
  readonly pokemon: readonly BattlePokemonState[];
  readonly activePokemonIndex?: number;
}

export function createBattleParticipant(
  input: CreateBattleParticipantInput
): BattleParticipant {
  if (input.id.trim().length === 0) {
    throw new Error("Battle participant id cannot be empty");
  }

  if (input.pokemon.length === 0) {
    throw new Error(`Battle participant "${input.id}" must contain at least one Pokémon`);
  }

  assertUniquePokemonInstances(input.pokemon);

  const activePokemonIndex = input.activePokemonIndex ?? 0;

  if (
    !Number.isInteger(activePokemonIndex) ||
    activePokemonIndex < 0 ||
    activePokemonIndex >= input.pokemon.length
  ) {
    throw new Error(
      `Invalid active Pokémon index ${activePokemonIndex} for battle participant "${input.id}"`
    );
  }

  return {
    id: input.id,
    type: input.type,
    side: input.side,
    pokemon: [...input.pokemon],
    activePokemonIndex,
  };
}

export function getActiveBattlePokemon(
  participant: BattleParticipant
): BattlePokemonState {
  const pokemon = participant.pokemon[participant.activePokemonIndex];

  if (!pokemon) {
    throw new Error(
      `Battle participant "${participant.id}" has an invalid active Pokémon index`
    );
  }

  return pokemon;
}

function assertUniquePokemonInstances(pokemon: readonly BattlePokemonState[]): void {
  const instanceIds = new Set<string>();

  for (const battlePokemon of pokemon) {
    const instanceId = battlePokemon.pokemon.instanceId;

    if (instanceIds.has(instanceId)) {
      throw new Error(
        `Battle participant contains duplicate Pokémon instance "${instanceId}"`
      );
    }

    instanceIds.add(instanceId);
  }
}
