import { describe, expect, it } from 'vitest';

import {
  createBattleCommand,
  createBattleParticipant,
  createBattlePokemonState,
  createPokemonInstance,
  getPokemonMove,
  type BattleTurnResolutionEntry,
  type PokemonInstance,
  type WildBattleInstance,
} from '@cesar-mmo/shared';

import type { PokemonBattleSession } from '../pokemon-battle-session';
import { PokemonBattleTurnExecutor } from '../pokemon-battle-turn.executor';

function createRuntime(moveId: number): {
  readonly session: PokemonBattleSession;
  readonly entry: BattleTurnResolutionEntry;
  readonly targetPokemonInstanceId: string;
  readonly targetState: ReturnType<typeof createBattlePokemonState>;
} {
  const move = getPokemonMove(moveId);

  if (!move) {
    throw new Error(`Move ${moveId} missing from registry`);
  }

  const actor = createPokemonInstance(4, 30);
  actor.moves = [{ moveId, currentPp: move.pp ?? 1 }];

  const target = createPokemonInstance(25, 30);

  const actorState = createBattlePokemonState(actor);
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
    battleId: `status-executor-${moveId}`,
    type: 'wild',
    status: 'active',
    participants: [player, wild],
  };

  const session: PokemonBattleSession = {
    battle,
    trainerBindings: [
      {
        participantId: player.id,
        trainerId: 'trainer-status-test',
        playerId: 'player-socket',
        participatingPokemonInstanceIds: new Set([actor.instanceId]),
      },
    ],
  };

  const command = createBattleCommand(battle, {
    participantId: player.id,
    action: { type: 'use-move', moveId },
  });

  const entry: BattleTurnResolutionEntry = {
    command,
    actionPriority: 0,
    movePriority: move.priority,
    speed: 1,
    tieBreaker: 0,
  };

  return {
    session,
    entry,
    targetPokemonInstanceId: target.instanceId,
    targetState,
  };
}

function sequenceRandom(...values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? 0;
}

function createExecutor(random: () => number): PokemonBattleTurnExecutor {
  return new PokemonBattleTurnExecutor({
    trainerStateStore: {} as never,
    trainerService: {} as never,
    captureService: {} as never,
    random,
  });
}

describe('PokemonBattleTurnExecutor - status infliction', () => {
  it('applies a status-only move after the authoritative accuracy check', async () => {
    const runtime = createRuntime(261); // Will-O-Wisp
    const executor = createExecutor(() => 0);

    const result = await executor.execute(
      runtime.session,
      runtime.entry,
      'player-socket',
    );

    expect(runtime.targetState.statusState?.major).toEqual({ type: 'burn' });
    expect(result.events).toEqual([
      expect.objectContaining({ type: 'move-used', moveId: 261 }),
      {
        type: 'status-inflicted',
        participantId: 'wild',
        pokemonInstanceId: runtime.targetPokemonInstanceId,
        status: 'burn',
        sourceParticipantId: 'player',
        sourcePokemonInstanceId:
          runtime.session.battle.participants[0]!.pokemon[0]!.pokemon.instanceId,
        moveId: 261,
      },
    ]);
  });

  it('applies a secondary status after damaging move resolution', async () => {
    const runtime = createRuntime(52); // Ember: accuracy RNG, damage RNG, 10% burn RNG
    const executor = createExecutor(sequenceRandom(0, 0.5, 0.05));

    const result = await executor.execute(
      runtime.session,
      runtime.entry,
      'player-socket',
    );

    expect(runtime.targetState.currentHp).toBeGreaterThan(0);
    expect(runtime.targetState.statusState?.major).toEqual({ type: 'burn' });
    expect(result.events.map((event) => event.type)).toEqual([
      'move-used',
      'damage-applied',
      'status-inflicted',
    ]);
  });
});
