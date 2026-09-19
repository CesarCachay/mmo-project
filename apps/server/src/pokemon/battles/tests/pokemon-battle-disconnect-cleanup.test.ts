import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PokemonBattleSession } from '../pokemon-battle-session';
import { PokemonBattleNetworkController } from '../pokemon-battle-network.controller';

function createSession(): PokemonBattleSession {
  return {
    battle: {
      battleId: 'battle-disconnect-test',
      type: 'trainer',
      status: 'active',
      participants: [
        {
          id: 'local-participant',
          type: 'trainer',
          side: 'side-a',
          activePokemonIndex: 0,
          pokemon: [],
        },
        {
          id: 'npc-participant',
          type: 'trainer',
          side: 'side-b',
          activePokemonIndex: 0,
          pokemon: [],
        },
      ],
    } as never,
    trainerBindings: [
      {
        participantId: 'local-participant',
        trainerId: 'trainer-disconnect-test',
        playerId: 'socket-a',
        participatingPokemonInstanceIds: new Set<string>(),
      },
    ],
    trainerBattle: {
      npcId: 'studentGary',
      trainerBattleId: 'student-gary',
      opponentParticipantId: 'npc-participant',
    },
  };
}

function createController(input?: {
  readonly session?: PokemonBattleSession;
  readonly syncBattleParticipantResult?: ReturnType<typeof vi.fn>;
}) {
  const syncBattleParticipantResult =
    input?.syncBattleParticipantResult ?? vi.fn().mockResolvedValue({});
  const getByPlayerId = vi.fn(() => input?.session);
  const removeSession = vi.fn();
  const removeTurn = vi.fn();

  const controller = new PokemonBattleNetworkController({
    trainerStateStore: {} as never,
    trainerService: { syncBattleParticipantResult } as never,
    battleSessionStore: {
      getByPlayerId,
      remove: removeSession,
    } as never,
    battleTurnStore: { remove: removeTurn } as never,
    turnExecutor: {} as never,
    wildBattleProgressionService: {} as never,
    trainerStatePresenter: {} as never,
    onTrainerDefeated: vi.fn(),
    onTrainerBattleVictory: vi.fn(),
  });

  return {
    controller,
    syncBattleParticipantResult,
    getByPlayerId,
    removeSession,
    removeTurn,
  };
}

describe('PokemonBattleNetworkController disconnect cleanup', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('persists the local participant and releases the active Battle', async () => {
    const session = createSession();
    const runtime = createController({ session });

    await runtime.controller.handlePlayerDisconnected('socket-a');

    expect(runtime.syncBattleParticipantResult).toHaveBeenCalledOnce();
    expect(runtime.syncBattleParticipantResult).toHaveBeenCalledWith(
      'trainer-disconnect-test',
      session.battle.participants[0],
    );
    expect(runtime.removeTurn).toHaveBeenCalledWith('battle-disconnect-test');
    expect(runtime.removeSession).toHaveBeenCalledWith('battle-disconnect-test');
  });

  it('still releases the Battle when persistence fails', async () => {
    const session = createSession();
    const persistenceError = new Error('database unavailable');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const runtime = createController({
      session,
      syncBattleParticipantResult: vi.fn().mockRejectedValue(persistenceError),
    });

    await runtime.controller.handlePlayerDisconnected('socket-a');

    expect(errorSpy).toHaveBeenCalled();
    expect(runtime.removeTurn).toHaveBeenCalledWith('battle-disconnect-test');
    expect(runtime.removeSession).toHaveBeenCalledWith('battle-disconnect-test');
  });

  it('does nothing when the player has no active Battle', async () => {
    const runtime = createController();

    await runtime.controller.handlePlayerDisconnected('socket-a');

    expect(runtime.syncBattleParticipantResult).not.toHaveBeenCalled();
    expect(runtime.removeTurn).not.toHaveBeenCalled();
    expect(runtime.removeSession).not.toHaveBeenCalled();
  });
});
