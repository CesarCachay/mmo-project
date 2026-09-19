import { describe, expect, it } from 'vitest';

import { createPokemonInstance } from '@cesar-mmo/shared';

import { createPokemonBattleSession } from '../pokemon-battle-session';
import {
  createTrainerBattleAiCommand,
  selectTrainerBattleAiReplacementPokemonIndex,
} from '../pokemon-trainer-battle-ai.factory';
import { createTrainerBattleInstance } from '../pokemon-trainer-battle.factory';

function createGarySession() {
  const battle = createTrainerBattleInstance({
    trainerBattleId: 'student-gary',
    trainerPokemon: [createPokemonInstance(1, 12)],
  });

  const playerParticipant = battle.participants.find(
    (participant) => participant.side === 'side-a',
  )!;
  const opponentParticipant = battle.participants.find(
    (participant) => participant.side === 'side-b',
  )!;

  return createPokemonBattleSession({
    battle,
    trainerBindings: [
      {
        participantId: playerParticipant.id,
        trainerId: 'trainer-a',
        playerId: 'player-a',
      },
    ],
    trainerBattle: {
      npcId: 'studentGary',
      trainerBattleId: 'student-gary',
      opponentParticipantId: opponentParticipant.id,
    },
  });
}

describe('createTrainerBattleAiCommand', () => {
  it('selects the first usable move for basic AI when random is 0', () => {
    const session = createGarySession();
    const command = createTrainerBattleAiCommand(session, () => 0);

    expect(command.participantId).toBe(session.trainerBattle?.opponentParticipantId);
    expect(command.action).toEqual({ type: 'use-move', moveId: 33 });
  });

  it('can select another usable move through the injected random source', () => {
    const session = createGarySession();
    const command = createTrainerBattleAiCommand(session, () => 0.999);

    expect(command.action).toEqual({ type: 'use-move', moveId: 98 });
  });

  it('never selects a move with zero PP', () => {
    const session = createGarySession();
    const opponent = session.battle.participants.find(
      (participant) => participant.id === session.trainerBattle?.opponentParticipantId,
    )!;

    opponent.pokemon[0]!.pokemon.moves[0]!.currentPp = 0;

    const command = createTrainerBattleAiCommand(session, () => 0);
    expect(command.action).toEqual({ type: 'use-move', moveId: 98 });
  });

  it('uses Struggle when every regular move is out of PP', () => {
    const session = createGarySession();
    const opponent = session.battle.participants.find(
      (participant) => participant.id === session.trainerBattle?.opponentParticipantId,
    )!;

    opponent.pokemon[0]!.pokemon.moves.forEach((move) => {
      move.currentPp = 0;
    });

    const command = createTrainerBattleAiCommand(session, () => 0);

    expect(command.action).toEqual({ type: 'struggle' });
  });
});


describe('selectTrainerBattleAiReplacementPokemonIndex', () => {
  it('selects the first usable party slot for basic AI', () => {
    const session = createGarySession();
    const opponent = session.battle.participants.find(
      (participant) => participant.id === session.trainerBattle?.opponentParticipantId,
    )!;

    opponent.pokemon[0]!.currentHp = 0;

    expect(
      selectTrainerBattleAiReplacementPokemonIndex(session, [1]),
    ).toBe(1);
  });

  it('rejects a fainted replacement candidate', () => {
    const session = createGarySession();
    const opponent = session.battle.participants.find(
      (participant) => participant.id === session.trainerBattle?.opponentParticipantId,
    )!;

    opponent.pokemon[0]!.currentHp = 0;
    opponent.pokemon[1]!.currentHp = 0;

    expect(() =>
      selectTrainerBattleAiReplacementPokemonIndex(session, [1]),
    ).toThrow(/invalid replacement candidate/i);
  });
});
