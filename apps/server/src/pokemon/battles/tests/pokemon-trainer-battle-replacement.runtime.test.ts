import { describe, expect, it } from 'vitest';

import {
  createPokemonInstance,
  type BattleCommand,
} from '@cesar-mmo/shared';

import {
  createPokemonBattleSession,
  getPokemonBattleParticipatingPokemonInstanceIds,
} from '../pokemon-battle-session';
import { PokemonBattleTurnStore } from '../pokemon-battle-turn.store';
import { applyPokemonTrainerBattleReplacement } from '../pokemon-trainer-battle-replacement.runtime';
import { createTrainerBattleInstance } from '../pokemon-trainer-battle.factory';

function createSession() {
  const battle = createTrainerBattleInstance({
    trainerBattleId: 'student-gary',
    trainerPokemon: [
      createPokemonInstance(1, 12),
      createPokemonInstance(4, 12),
    ],
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

  return {
    session,
    playerParticipant,
    opponentParticipant,
  };
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
    action: { type: 'use-move', moveId: 1 },
  };

  turnStore.submitCommand(session.battle, playerCommand);
  turnStore.submitCommand(session.battle, opponentCommand);
}

describe('applyPokemonTrainerBattleReplacement - Trainer Battle', () => {
  it('replaces the fainted local Pokémon and advances to the next turn', () => {
    const { session, playerParticipant, opponentParticipant } = createSession();
    const turnStore = new PokemonBattleTurnStore();

    createResolvedTurn(
      turnStore,
      session,
      playerParticipant.id,
      opponentParticipant.id,
    );

    playerParticipant.pokemon[0]!.currentHp = 0;

    const replacementPokemon = playerParticipant.pokemon[1]!;

    const result = applyPokemonTrainerBattleReplacement({
      session,
      playerId: 'player-a',
      replacementPokemonIndex: 1,
      battleTurnStore: turnStore,
    });

    expect(playerParticipant.activePokemonIndex).toBe(1);
    expect(result.previousActivePokemonIndex).toBe(0);
    expect(result.currentActivePokemonIndex).toBe(1);
    expect(result.activePokemonInstanceId).toBe(
      replacementPokemon.pokemon.instanceId,
    );
    expect(result.nextTurnNumber).toBe(2);
    expect(turnStore.getByBattleId(session.battle.battleId)?.number).toBe(2);

    expect(
      getPokemonBattleParticipatingPokemonInstanceIds(
        session,
        playerParticipant.id,
      ),
    ).toContain(replacementPokemon.pokemon.instanceId);
  });

  it('rejects a replacement outside the server-computed candidates', () => {
    const { session, playerParticipant, opponentParticipant } = createSession();
    const turnStore = new PokemonBattleTurnStore();

    createResolvedTurn(
      turnStore,
      session,
      playerParticipant.id,
      opponentParticipant.id,
    );

    playerParticipant.pokemon[0]!.currentHp = 0;
    playerParticipant.pokemon[1]!.currentHp = 0;

    expect(() =>
      applyPokemonTrainerBattleReplacement({
        session,
        playerId: 'player-a',
        replacementPokemonIndex: 1,
        battleTurnStore: turnStore,
      }),
    ).toThrow(/does not require local Trainer replacement|no usable replacement/i);
  });
});
