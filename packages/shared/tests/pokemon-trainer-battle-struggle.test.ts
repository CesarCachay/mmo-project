import { describe, expect, it } from 'vitest';

import {
  POKEMON_STRUGGLE_MOVE_ID,
  createBattleCommand,
  createBattleMoveExecutionContext,
  createBattleParticipant,
  createBattlePokemonState,
  createBattleTurn,
  createBattleTurnResolutionOrder,
  createPokemonInstance,
  isPokemonBattleCommandInput,
} from '../src/index.js';

function createBattle() {
  const playerPokemon = createPokemonInstance(1, 10);
  const opponentPokemon = createPokemonInstance(19, 10);

  playerPokemon.moves.forEach((move) => {
    move.currentPp = 0;
  });

  const player = createBattleParticipant({
    id: 'player-participant',
    type: 'trainer',
    side: 'side-a',
    pokemon: [createBattlePokemonState(playerPokemon)],
    activePokemonIndex: 0,
  });

  const opponent = createBattleParticipant({
    id: 'opponent-participant',
    type: 'trainer',
    side: 'side-b',
    pokemon: [createBattlePokemonState(opponentPokemon)],
    activePokemonIndex: 0,
  });

  return {
    battleId: 'trainer-battle-struggle',
    type: 'trainer' as const,
    status: 'active' as const,
    participants: [player, opponent],
  };
}

describe('Trainer Battle Struggle fallback', () => {
  it('allows the internal Struggle command only when all regular moves are out of PP', () => {
    const battle = createBattle();

    expect(
      createBattleCommand(battle, {
        participantId: 'player-participant',
        action: { type: 'struggle' },
      }).action,
    ).toEqual({ type: 'struggle' });

    battle.participants[0]!.pokemon[0]!.pokemon.moves[0]!.currentPp = 1;

    expect(() =>
      createBattleCommand(battle, {
        participantId: 'player-participant',
        action: { type: 'struggle' },
      }),
    ).toThrow(/regular move still has PP/i);
  });

  it('resolves Struggle through move 165 without adding it to learned move slots', () => {
    const battle = createBattle();

    const playerCommand = createBattleCommand(battle, {
      participantId: 'player-participant',
      action: { type: 'struggle' },
    });

    const opponentMoveId =
      battle.participants[1]!.pokemon[0]!.pokemon.moves[0]!.moveId;

    const opponentCommand = createBattleCommand(battle, {
      participantId: 'opponent-participant',
      action: { type: 'use-move', moveId: opponentMoveId },
    });

    let turn = createBattleTurn(battle, 1);
    turn = {
      ...turn,
      commands: [playerCommand, opponentCommand],
    };

    const order = createBattleTurnResolutionOrder(battle, turn, () => 0.5);
    const playerEntry = order.entries.find(
      (entry) => entry.command.participantId === 'player-participant',
    )!;

    const context = createBattleMoveExecutionContext(battle, playerEntry);

    expect(context.move.id).toBe(POKEMON_STRUGGLE_MOVE_ID);
    expect(context.selectedMove).toEqual({
      moveId: POKEMON_STRUGGLE_MOVE_ID,
      currentPp: 1,
    });
    expect(
      battle.participants[0]!.pokemon[0]!.pokemon.moves.some(
        (move) => move.moveId === POKEMON_STRUGGLE_MOVE_ID,
      ),
    ).toBe(false);
  });

  it('accepts Struggle over the public command contract while domain validation still guards PP', () => {
    expect(
      isPokemonBattleCommandInput({
        battleId: 'trainer-battle-struggle',
        action: { type: 'struggle' },
      }),
    ).toBe(true);
  });
});
