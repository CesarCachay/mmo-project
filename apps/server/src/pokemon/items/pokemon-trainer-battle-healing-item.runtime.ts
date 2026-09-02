import {
  planBattleHealingItemUse,
  type BattleTurnResolutionEntry,
  type PokemonItemId,
  type PokemonTrainerState,
} from '@cesar-mmo/shared';

import type { PokemonBattleSession } from '../battles/pokemon-battle-session';
import type { PokemonTrainerService } from '../pokemon-trainer.service';
import type { PokemonTrainerStateStore } from '../pokemon-trainer-state.store';
import type { PokemonTrainerId } from '../pokemon-trainer-identity';

export interface ApplyPokemonTrainerBattleHealingItemInput {
  readonly session: PokemonBattleSession;
  readonly entry: BattleTurnResolutionEntry;
  readonly playerId: string;
  readonly trainerStateStore: PokemonTrainerStateStore;
  readonly trainerService: PokemonTrainerService;
}

export interface PokemonTrainerBattleHealingItemRuntimeResult {
  readonly battleId: string;
  readonly participantId: string;
  readonly trainerId: PokemonTrainerId;
  readonly itemId: PokemonItemId;
  readonly targetPokemonInstanceId: string;
  readonly previousHp: number;
  readonly currentHp: number;
  readonly maxHp: number;
  readonly requestedHealing: number;
  readonly appliedHealing: number;
  readonly trainerState: PokemonTrainerState;
}

export async function applyPokemonTrainerBattleHealingItem(
  input: ApplyPokemonTrainerBattleHealingItemInput,
): Promise<PokemonTrainerBattleHealingItemRuntimeResult> {
  const { session, entry, playerId, trainerStateStore, trainerService } = input;

  const battle = session.battle;

  /* 1. Este runtime solamente procesa use-item. */
  if (entry.command.action.type !== 'use-item') {
    throw new Error(
      `Battle command "${entry.command.action.type}" cannot be resolved by healing item runtime`,
    );
  }

  const action = entry.command.action;

  /* 2. Defensive battle consistency */
  if (entry.command.battleId !== battle.battleId) {
    throw new Error(
      `Battle command "${entry.command.battleId}" does not belong to battle "${battle.battleId}"`,
    );
  }

  /*
   * 3. Resolve authoritative Trainer binding.
   * Browser never supplies trainerId.
   */
  const trainerBinding = session.trainerBindings.find(
    (binding) => binding.playerId === playerId,
  );

  if (!trainerBinding) {
    throw new Error(
      `Player "${playerId}" is not bound to battle "${battle.battleId}"`,
    );
  }

  /*
   * The command must belong to the exact Trainer
   * participant bound to this player.
   */
  if (trainerBinding.participantId !== entry.command.participantId) {
    throw new Error(
      `Player "${playerId}" cannot use item for participant "${entry.command.participantId}"`,
    );
  }

  /* 4. Resolve authoritative TrainerState */
  const trainerState = trainerStateStore.get(trainerBinding.trainerId);

  if (!trainerState) {
    throw new Error(
      `Pokémon Trainer state not found for trainer "${trainerBinding.trainerId}"`,
    );
  }

  /*
   * 5. Plan EVERYTHING before persistence.
   *
   * This validates:
   * - Battle active
   * - Trainer participant
   * - item battleUsable
   * - inventory quantity
   * - target ownership
   * - target alive
   * - HP not full
   * - healing amount
   */
  const plan = planBattleHealingItemUse(
    battle,
    trainerBinding.participantId,
    action,
    trainerState.inventory,
  );

  /* Resolve target BEFORE await */
  const trainerParticipant = battle.participants.find(
    (participant) => participant.id === trainerBinding.participantId,
  );

  if (!trainerParticipant || trainerParticipant.type !== 'trainer') {
    throw new Error(
      `Trainer participant "${trainerBinding.participantId}" not found in battle "${battle.battleId}"`,
    );
  }

  const target = trainerParticipant.pokemon.find(
    (pokemonState) =>
      pokemonState.pokemon.instanceId === plan.targetPokemonInstanceId,
  );

  if (!target) {
    throw new Error(
      `Target Pokémon "${plan.targetPokemonInstanceId}" not found in battle "${battle.battleId}"`,
    );
  }

  /* 6. INVENTORY PERSISTENCE FIRST */
  const updatedTrainerState = await trainerService.consumeInventoryItem(
    trainerBinding.trainerId,
    action.itemId,
    1,
  );

  /* 7. Only after inventory persistence succeeds may Battle HP change */
  target.currentHp = plan.currentHp;

  return {
    battleId: battle.battleId,
    participantId: trainerBinding.participantId,
    trainerId: trainerBinding.trainerId,
    itemId: action.itemId,
    targetPokemonInstanceId: plan.targetPokemonInstanceId,
    previousHp: plan.previousHp,
    currentHp: plan.currentHp,
    maxHp: plan.maxHp,
    requestedHealing: plan.requestedHealing,
    appliedHealing: plan.appliedHealing,
    trainerState: updatedTrainerState,
  };
}
