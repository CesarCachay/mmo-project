import {
  createBattleCommand,
  getActiveBattlePokemon,
  type BattleCommand,
  type BattleInstance,
} from '@cesar-mmo/shared';

export type BattleRandomSource = () => number;

export function createWildBattleCommand(
  battle: BattleInstance,
  random: BattleRandomSource = Math.random,
): BattleCommand {
  const wildParticipant = battle.participants.find(
    (participant) => participant.type === 'wild',
  );

  if (!wildParticipant) {
    throw new Error(
      `Wild participant not found in battle "${battle.battleId}"`,
    );
  }

  const activePokemon = getActiveBattlePokemon(wildParticipant);
  const availableMoves = activePokemon.pokemon.moves.filter(
    (move) => move.currentPp > 0,
  );

  if (availableMoves.length === 0) {
    throw new Error(
      `Wild Pokémon "${activePokemon.pokemon.instanceId}" has no usable moves`,
    );
  }

  const randomValue = random();

  if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
    throw new Error(`Invalid battle random value "${randomValue}"`);
  }

  const moveIndex = Math.floor(randomValue * availableMoves.length);
  const selectedMove = availableMoves[moveIndex];

  if (!selectedMove) {
    throw new Error(
      `Failed to select wild move in battle "${battle.battleId}"`,
    );
  }

  return createBattleCommand(battle, {
    participantId: wildParticipant.id,
    action: {
      type: 'use-move',
      moveId: selectedMove.moveId,
    },
  });
}
