import { describe, expect, it } from 'vitest';

import {
  createBattleCommand,
  createPokemonInstance,
  type BattleTurnResolutionEntry,
} from '@cesar-mmo/shared';

import { createPokemonBattleSession } from '../pokemon-battle-session';
import { applyPokemonTrainerBattleSwitch } from '../pokemon-trainer-battle-switch.runtime';
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

  return { session, playerParticipant };
}

describe('applyPokemonTrainerBattleSwitch - Trainer Battle', () => {
  it('allows a voluntary local switch while Trainer Battle continuation is normal', () => {
    const { session, playerParticipant } = createSession();

    const command = createBattleCommand(session.battle, {
      participantId: playerParticipant.id,
      action: {
        type: 'switch-pokemon',
        pokemonIndex: 1,
      },
    });

    const entry: BattleTurnResolutionEntry = {
      command,
      actionPriority: 1,
      movePriority: 0,
      speed: 1,
      tieBreaker: 0,
    };

    const result = applyPokemonTrainerBattleSwitch({ session, entry });

    expect(result.previousActivePokemonIndex).toBe(0);
    expect(result.currentActivePokemonIndex).toBe(1);
    expect(playerParticipant.activePokemonIndex).toBe(1);
  });

  it('clears confusion and resets Bad Poison escalation on voluntary switch', () => {
    const { session, playerParticipant } = createSession();
    playerParticipant.pokemon[0]!.statusState = {
      major: { type: 'badly-poisoned', toxicCounter: 5 },
      confusion: { turnsRemaining: 3 },
    };

    const command = createBattleCommand(session.battle, {
      participantId: playerParticipant.id,
      action: {
        type: 'switch-pokemon',
        pokemonIndex: 1,
      },
    });

    const entry: BattleTurnResolutionEntry = {
      command,
      actionPriority: 1,
      movePriority: 0,
      speed: 1,
      tieBreaker: 0,
    };

    applyPokemonTrainerBattleSwitch({ session, entry });

    expect(playerParticipant.pokemon[0]!.statusState).toEqual({
      major: { type: 'badly-poisoned', toxicCounter: 1 },
      confusion: null,
    });
  });

  it('rejects voluntary switch when the active local Pokémon has fainted', () => {
    const { session, playerParticipant } = createSession();
    playerParticipant.pokemon[0]!.currentHp = 0;

    const command = {
      battleId: session.battle.battleId,
      participantId: playerParticipant.id,
      action: {
        type: 'switch-pokemon' as const,
        pokemonIndex: 1,
      },
    };

    const entry: BattleTurnResolutionEntry = {
      command,
      actionPriority: 1,
      movePriority: 0,
      speed: 1,
      tieBreaker: 0,
    };

    expect(() => applyPokemonTrainerBattleSwitch({ session, entry })).toThrow(
      /player-replacement-required/i,
    );
  });
});
