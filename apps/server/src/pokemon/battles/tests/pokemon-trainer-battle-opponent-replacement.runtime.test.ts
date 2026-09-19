import { describe, expect, it } from 'vitest';

import {
  createPokemonInstance,
  type BattleCommand,
} from '@cesar-mmo/shared';

import { createPokemonBattleSession } from '../pokemon-battle-session';
import { applyPokemonTrainerBattleOpponentReplacement } from '../pokemon-trainer-battle-opponent-replacement.runtime';
import { PokemonBattleTurnStore } from '../pokemon-battle-turn.store';
import { createTrainerBattleInstance } from '../pokemon-trainer-battle.factory';

function createSession() {
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

  const session = createPokemonBattleSession({
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

  return { session, playerParticipant, opponentParticipant };
}

function createResolvedTurn(
  turnStore: PokemonBattleTurnStore,
  session: ReturnType<typeof createSession>['session'],
  playerParticipantId: string,
  opponentParticipantId: string,
): void {
  turnStore.create(session.battle);

  const playerCommand: BattleCommand = {
    battleId: session.battle.battleId,
    participantId: playerParticipantId,
    action: { type: 'use-move', moveId: 1 },
  };

  const opponentCommand: BattleCommand = {
    battleId: session.battle.battleId,
    participantId: opponentParticipantId,
    action: { type: 'use-move', moveId: 33 },
  };

  turnStore.submitCommand(session.battle, playerCommand);
  turnStore.submitCommand(session.battle, opponentCommand);
}

describe('applyPokemonTrainerBattleOpponentReplacement', () => {
  it('automatically replaces a fainted NPC Pokémon and advances the turn', () => {
    const { session, playerParticipant, opponentParticipant } = createSession();
    const turnStore = new PokemonBattleTurnStore();

    createResolvedTurn(
      turnStore,
      session,
      playerParticipant.id,
      opponentParticipant.id,
    );

    const rattata = opponentParticipant.pokemon[0]!;
    const pidgey = opponentParticipant.pokemon[1]!;
    rattata.currentHp = 0;

    const result = applyPokemonTrainerBattleOpponentReplacement({
      session,
      localParticipantId: playerParticipant.id,
      battleTurnStore: turnStore,
    });

    expect(opponentParticipant.activePokemonIndex).toBe(1);
    expect(result.previousActivePokemonIndex).toBe(0);
    expect(result.currentActivePokemonIndex).toBe(1);
    expect(result.previousPokemonInstanceId).toBe(rattata.pokemon.instanceId);
    expect(result.activePokemonInstanceId).toBe(pidgey.pokemon.instanceId);
    expect(result.nextTurnNumber).toBe(2);
    expect(turnStore.getByBattleId(session.battle.battleId)?.number).toBe(2);

    expect(result.presentationEvent).toEqual({
      type: 'pokemon-switched',
      participantId: opponentParticipant.id,
      previousActivePokemonIndex: 0,
      currentActivePokemonIndex: 1,
      previousPokemonInstanceId: rattata.pokemon.instanceId,
      currentPokemonInstanceId: pidgey.pokemon.instanceId,
    });
  });

  it('rejects automatic replacement when the NPC party is fully defeated', () => {
    const { session, playerParticipant, opponentParticipant } = createSession();
    const turnStore = new PokemonBattleTurnStore();

    createResolvedTurn(
      turnStore,
      session,
      playerParticipant.id,
      opponentParticipant.id,
    );

    opponentParticipant.pokemon.forEach((pokemon) => {
      pokemon.currentHp = 0;
    });

    expect(() =>
      applyPokemonTrainerBattleOpponentReplacement({
        session,
        localParticipantId: playerParticipant.id,
        battleTurnStore: turnStore,
      }),
    ).toThrow(/does not require opponent replacement|opponent-defeated/i);
  });
});
