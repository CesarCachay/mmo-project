import { describe, expect, it } from 'vitest';

import {
  createBattleCommand,
  createBattleParticipant,
  createBattlePokemonState,
  createPokemonInstance,
  getPokemonMove,
  type BattleTurnResolutionEntry,
  type WildBattleInstance,
} from '@cesar-mmo/shared';

import type { PokemonBattleSession } from '../pokemon-battle-session';
import { PokemonBattleTurnExecutor } from '../pokemon-battle-turn.executor';

function createRuntime(moveId = 14): {
  readonly session: PokemonBattleSession;
  readonly entry: BattleTurnResolutionEntry;
  readonly actorState: ReturnType<typeof createBattlePokemonState>;
  readonly actorMove: { moveId: number; currentPp: number };
} {
  const move = getPokemonMove(moveId);

  if (!move) {
    throw new Error(`Move ${moveId} missing from registry`);
  }

  const actor = createPokemonInstance(25, 30);
  const actorMove = { moveId, currentPp: move.pp ?? 1 };
  actor.moves = [actorMove];

  const target = createPokemonInstance(1, 30);

  const actorState = createBattlePokemonState(actor);
  const battleActorMove = actorState.pokemon.moves[0];

  if (!battleActorMove) {
    throw new Error(`Battle move ${moveId} missing from actor snapshot`);
  }

  const targetState = createBattlePokemonState(target);

  const player = createBattleParticipant({
    id: 'player',
    type: 'trainer',
    side: 'side-a',
    pokemon: [actorState],
  });

  const wild = createBattleParticipant({
    id: 'wild',
    type: 'wild',
    side: 'side-b',
    pokemon: [targetState],
  });

  const battle: WildBattleInstance = {
    battleId: `status-action-executor-${moveId}`,
    type: 'wild',
    status: 'active',
    participants: [player, wild],
  };

  const session: PokemonBattleSession = {
    battle,
    trainerBindings: [
      {
        participantId: player.id,
        trainerId: 'trainer-status-action-test',
        playerId: 'player-socket',
        participatingPokemonInstanceIds: new Set([actor.instanceId]),
      },
    ],
  };

  const command = createBattleCommand(battle, {
    participantId: player.id,
    action: { type: 'use-move', moveId },
  });

  return {
    session,
    entry: {
      command,
      actionPriority: 0,
      movePriority: move.priority,
      speed: 1,
      tieBreaker: 0,
    },
    actorState,
    actorMove: battleActorMove,
  };
}

function sequenceRandom(...values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index++];
    if (value === undefined) {
      throw new Error(`Unexpected RNG read at index ${index - 1}`);
    }
    return value;
  };
}

function createExecutor(random: () => number): PokemonBattleTurnExecutor {
  return new PokemonBattleTurnExecutor({
    trainerStateStore: {} as never,
    trainerService: {} as never,
    captureService: {} as never,
    random,
  });
}

describe('PokemonBattleTurnExecutor - status action restrictions', () => {
  it('blocks a sleeping Pokémon before PP consumption or move-used presentation', async () => {
    const runtime = createRuntime();
    runtime.actorState.statusState!.major = {
      type: 'sleep',
      turnsRemaining: 2,
    };
    const previousPp = runtime.actorMove.currentPp;

    const result = await createExecutor(() => {
      throw new Error('sleep restriction must not consume RNG');
    }).execute(runtime.session, runtime.entry, 'player-socket');

    expect(runtime.actorMove.currentPp).toBe(previousPp);
    expect(runtime.actorState.statusState?.major).toEqual({
      type: 'sleep',
      turnsRemaining: 1,
    });
    expect(result.events).toEqual([
      expect.objectContaining({
        type: 'status-action-prevented',
        participantId: 'player',
        status: 'sleep',
      }),
    ]);
  });

  it('blocks full paralysis before PP consumption', async () => {
    const runtime = createRuntime();
    runtime.actorState.statusState!.major = { type: 'paralysis' };
    const previousPp = runtime.actorMove.currentPp;

    const result = await createExecutor(() => 0).execute(
      runtime.session,
      runtime.entry,
      'player-socket',
    );

    expect(runtime.actorMove.currentPp).toBe(previousPp);
    expect(result.events).toEqual([
      expect.objectContaining({
        type: 'status-action-prevented',
        status: 'paralysis',
      }),
    ]);
  });

  it('thaws naturally and then executes the selected move normally', async () => {
    const runtime = createRuntime();
    runtime.actorState.statusState!.major = { type: 'freeze' };
    const previousPp = runtime.actorMove.currentPp;

    // 0.1 => natural thaw. Move 14 (Swords Dance) has accuracy=null and the
    // current Battle V1 does not execute its stat-stage mechanic, so no more
    // RNG is required in this test.
    const result = await createExecutor(sequenceRandom(0.1)).execute(
      runtime.session,
      runtime.entry,
      'player-socket',
    );

    expect(runtime.actorState.statusState?.major).toBeNull();
    expect(runtime.actorMove.currentPp).toBe(previousPp - 1);
    expect(result.events.map((event) => event.type)).toEqual([
      'status-cleared',
      'move-used',
    ]);
  });

  it('applies confusion self-damage, consumes no PP, and emits faint when self-damage reaches zero HP', async () => {
    const runtime = createRuntime();
    runtime.actorState.statusState!.confusion = { turnsRemaining: 3 };
    runtime.actorState.currentHp = 1;
    const previousPp = runtime.actorMove.currentPp;

    const result = await createExecutor(sequenceRandom(0.1, 0.5)).execute(
      runtime.session,
      runtime.entry,
      'player-socket',
    );

    expect(runtime.actorMove.currentPp).toBe(previousPp);
    expect(runtime.actorState.currentHp).toBe(0);
    expect(runtime.actorState.statusState?.confusion).toEqual({
      turnsRemaining: 2,
    });
    expect(result.events.map((event) => event.type)).toEqual([
      'confusion-self-damage',
      'pokemon-fainted',
    ]);
  });
});
