import type {
  BattleInstance,
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
  readonly displayName?: string;
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

  const displayName = input.displayName?.trim();

  return {
    id: input.id,
    type: input.type,
    side: input.side,
    ...(displayName ? { displayName } : {}),
    pokemon: [...input.pokemon],
    activePokemonIndex,
  };
}


export function getBattleParticipantById(
  battle: BattleInstance,
  participantId: BattleParticipantId
): BattleParticipant {
  const participant = battle.participants.find(
    (candidate) => candidate.id === participantId
  );

  if (!participant) {
    throw new Error(
      `Battle participant "${participantId}" not found in battle "${battle.battleId}"`
    );
  }

  return participant;
}

export function getOpposingBattleParticipant(
  battle: BattleInstance,
  participantId: BattleParticipantId
): BattleParticipant {
  const participant = getBattleParticipantById(battle, participantId);

  const opponents = battle.participants.filter(
    (candidate) => candidate.side !== participant.side
  );

  if (opponents.length !== 1) {
    throw new Error(
      `Battle "${battle.battleId}" must contain exactly one opponent for participant "${participantId}"`
    );
  }

  const opponent = opponents[0];

  if (!opponent) {
    throw new Error(
      `Opponent for participant "${participantId}" not found in battle "${battle.battleId}"`
    );
  }

  return opponent;
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
