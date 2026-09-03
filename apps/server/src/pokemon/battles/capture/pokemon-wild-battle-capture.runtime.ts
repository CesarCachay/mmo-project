import {
  calculatePokemonMaxHp,
  getPokemonInventoryItemQuantity,
  getPokemonItem,
  getPokemonSpecies,
  resolvePokemonCapture,
} from '@cesar-mmo/shared';

import type {
  BattleUseItemAction,
  PokemonCaptureRandomSource,
  PokemonCaptureResolution,
  PokemonItemId,
  BattleTurnResolutionEntry,
  PokemonInstance,
  PokemonTrainerState,
} from '@cesar-mmo/shared';

import type { PokemonBattleSession } from '../pokemon-battle-session';

import type { PokemonTrainerId } from '../../pokemon-trainer-identity';

import { PokemonTrainerStateStore } from '../../pokemon-trainer-state.store';

import { PokemonTrainerService } from 'src/pokemon/pokemon-trainer.service';
import { PokemonCaptureService } from './pokemon-capture.service';

export interface PokemonWildBattleCapturePlan {
  readonly trainerId: PokemonTrainerId;
  readonly trainerParticipantId: string;

  readonly itemId: PokemonItemId;

  readonly wildParticipantId: string;
  readonly wildPokemonInstanceId: string;

  readonly speciesId: number;

  readonly currentHp: number;
  readonly maxHp: number;

  readonly captureRate: number;
  readonly ballModifier: number;
}

export interface PlanPokemonWildBattleCaptureInput {
  readonly session: PokemonBattleSession;
  readonly playerId: string;

  readonly action: BattleUseItemAction;

  readonly trainerStateStore: PokemonTrainerStateStore;
}

export function planPokemonWildBattleCapture(
  input: PlanPokemonWildBattleCaptureInput,
): PokemonWildBattleCapturePlan {
  const { session, playerId, action, trainerStateStore } = input;

  if (session.battle.status !== 'active') {
    throw new Error(
      `Cannot capture Pokémon in battle "${session.battle.battleId}" with status "${session.battle.status}"`,
    );
  }

  if (session.battle.type !== 'wild') {
    throw new Error(`Pokémon capture is only allowed in Wild Battles`);
  }

  if (action.target.type !== 'wild-active') {
    throw new Error(
      `Capture item "${action.itemId}" requires a Wild active target`,
    );
  }

  const trainerBinding = session.trainerBindings.find(
    (binding) => binding.playerId === playerId,
  );

  if (!trainerBinding) {
    throw new Error(`Trainer binding not found for player "${playerId}"`);
  }

  const trainerParticipant = session.battle.participants.find(
    (participant) => participant.id === trainerBinding.participantId,
  );

  if (!trainerParticipant) {
    throw new Error(
      `Trainer participant "${trainerBinding.participantId}" not found`,
    );
  }

  if (trainerParticipant.type !== 'trainer') {
    throw new Error(
      `Battle participant "${trainerParticipant.id}" is not a Trainer`,
    );
  }

  const trainerState = trainerStateStore.get(trainerBinding.trainerId);

  if (!trainerState) {
    throw new Error(
      `Pokémon Trainer state not found for trainer "${trainerBinding.trainerId}"`,
    );
  }

  const item = getPokemonItem(action.itemId);

  if (!item.battleUsable) {
    throw new Error(`Pokémon item "${action.itemId}" cannot be used in battle`);
  }

  if (item.battleTarget !== 'wild-active') {
    throw new Error(
      `Pokémon item "${action.itemId}" cannot target a Wild Pokémon`,
    );
  }

  if (!item.effect || item.effect.type !== 'capture') {
    throw new Error(`Pokémon item "${action.itemId}" is not a capture item`);
  }

  const quantity = getPokemonInventoryItemQuantity(
    trainerState.inventory,
    action.itemId,
  );

  if (quantity <= 0) {
    throw new Error(
      `Trainer "${trainerBinding.trainerId}" has no "${action.itemId}" remaining`,
    );
  }

  const wildParticipant = session.battle.participants.find(
    (participant) => participant.type === 'wild',
  );

  if (!wildParticipant) {
    throw new Error(
      `Wild participant not found in battle "${session.battle.battleId}"`,
    );
  }

  const wildPokemonState =
    wildParticipant.pokemon[wildParticipant.activePokemonIndex];

  if (!wildPokemonState) {
    throw new Error(
      `Wild active Pokémon not found in battle "${session.battle.battleId}"`,
    );
  }

  if (wildPokemonState.currentHp <= 0) {
    throw new Error(`Cannot capture a fainted Wild Pokémon`);
  }

  const species = getPokemonSpecies(wildPokemonState.pokemon.speciesId);

  if (!species) {
    throw new Error(
      `Pokémon species "${wildPokemonState.pokemon.speciesId}" not found`,
    );
  }

  const maxHp = calculatePokemonMaxHp(wildPokemonState.pokemon);

  return {
    trainerId: trainerBinding.trainerId,
    trainerParticipantId: trainerParticipant.id,
    itemId: action.itemId,
    wildParticipantId: wildParticipant.id,
    wildPokemonInstanceId: wildPokemonState.pokemon.instanceId,
    speciesId: wildPokemonState.pokemon.speciesId,
    currentHp: wildPokemonState.currentHp,
    maxHp,
    captureRate: species.captureRate,
    ballModifier: item.effect.ballModifier,
  };
}

export function resolvePokemonWildBattleCapture(
  plan: PokemonWildBattleCapturePlan,
  random: PokemonCaptureRandomSource = Math.random,
): PokemonCaptureResolution {
  return resolvePokemonCapture(
    {
      currentHp: plan.currentHp,
      maxHp: plan.maxHp,
      captureRate: plan.captureRate,
      ballModifier: plan.ballModifier,
    },
    random,
  );
}

export type PokemonWildBattleCaptureRuntimeResult =
  | {
      readonly type: 'capture-failed';
      readonly stopTurnResolution: false;
      readonly shakeCount: number;
      readonly trainerState: PokemonTrainerState;
    }
  | {
      readonly type: 'capture-succeeded';
      readonly stopTurnResolution: true;
      readonly terminalOutcome: 'wild-captured';
      readonly shakeCount: number;
      readonly trainerState: PokemonTrainerState;
      readonly partyPosition: number | null;
    };

export interface ExecutePokemonWildBattleCaptureInput {
  readonly session: PokemonBattleSession;
  readonly entry: BattleTurnResolutionEntry;
  readonly playerId: string;
  readonly trainerStateStore: PokemonTrainerStateStore;
  readonly trainerService: PokemonTrainerService;
  readonly captureService: PokemonCaptureService;
  readonly random?: PokemonCaptureRandomSource;
}

export async function executePokemonWildBattleCapture(
  input: ExecutePokemonWildBattleCaptureInput,
): Promise<PokemonWildBattleCaptureRuntimeResult> {
  const {
    session,
    entry,
    playerId,
    trainerStateStore,
    trainerService,
    captureService,
    random = Math.random,
  } = input;

  const action = entry.command.action;

  if (action.type !== 'use-item') {
    throw new Error(`Capture runtime requires a use-item action`);
  }

  if (action.target.type !== 'wild-active') {
    throw new Error(`Capture runtime requires a Wild active target`);
  }

  /* Re-run authoritative validation at execution time */
  const plan = planPokemonWildBattleCapture({
    session,
    playerId,
    action,
    trainerStateStore,
  });

  const captureResolution = resolvePokemonWildBattleCapture(plan, random);

  /*
   * Resolve the actual Wild object from the server-owned
   * Battle. Never accept this identifier from browser.
   */
  const wildParticipant = session.battle.participants.find(
    (participant) =>
      participant.id === plan.wildParticipantId && participant.type === 'wild',
  );

  if (!wildParticipant) {
    throw new Error(`Wild participant "${plan.wildParticipantId}" not found`);
  }

  const wildPokemonState =
    wildParticipant.pokemon[wildParticipant.activePokemonIndex];

  if (!wildPokemonState) {
    throw new Error(
      `Wild active Pokémon not found in battle "${session.battle.battleId}"`,
    );
  }

  if (wildPokemonState.pokemon.instanceId !== plan.wildPokemonInstanceId) {
    throw new Error(`Wild active Pokémon changed before capture execution`);
  }

  /* FAILURE - A failed capture still consumes one Ball */
  if (!captureResolution.captured) {
    const trainerState = await trainerService.consumeInventoryItem(
      plan.trainerId,
      plan.itemId,
      1,
    );

    return {
      type: 'capture-failed',
      stopTurnResolution: false,
      shakeCount: captureResolution.shakeCount,
      trainerState,
    };
  }

  /* SUCCESS */
  const trainerParticipant = session.battle.participants.find(
    (participant) =>
      participant.id === plan.trainerParticipantId &&
      participant.type === 'trainer',
  );

  if (!trainerParticipant) {
    throw new Error(
      `Trainer participant "${plan.trainerParticipantId}" not found`,
    );
  }

  await trainerService.syncBattleParticipantResult(
    plan.trainerId,
    trainerParticipant,
  );

  /*
   * Persist the actual Wild individual, using the Battle
   * currentHp rather than the original encounter HP.
   */
  const capturedPokemon: PokemonInstance = {
    ...wildPokemonState.pokemon,

    currentHp: wildPokemonState.currentHp,

    moves: wildPokemonState.pokemon.moves.map((move) => ({
      ...move,
    })),
  };

  /*
   * Atomic boundary:
   * Ball + captured PokemonInstance + moves + Party / Storage assignment
   */
  const persistedCapture = await captureService.persistSuccessfulCapture(
    plan.trainerId,
    plan.itemId,
    capturedPokemon,
  );

  return {
    type: 'capture-succeeded',
    stopTurnResolution: true,
    terminalOutcome: 'wild-captured',
    shakeCount: captureResolution.shakeCount,
    trainerState: persistedCapture.trainerState,
    partyPosition: persistedCapture.partyPosition,
  };
}
