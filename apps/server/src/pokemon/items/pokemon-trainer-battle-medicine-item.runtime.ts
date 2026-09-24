import {
  consumePokemonInventoryItem,
  ensureBattlePokemonStatusState,
  planBattleTrainerMedicineItemUse,
  type BattleMajorStatusCondition,
  type BattleTurnResolutionEntry,
  type PokemonItemId,
  type PokemonTrainerState,
} from '@cesar-mmo/shared';

import type { PokemonBattleSession } from '../battles/pokemon-battle-session';
import type { PokemonTrainerService } from '../pokemon-trainer.service';
import type { PokemonTrainerStateStore } from '../pokemon-trainer-state.store';
import type { PokemonTrainerId } from '../pokemon-trainer-identity';
import type { PokemonOverworldItemRepository } from './pokemon-overworld-item.repository';
import { applyPokemonTrainerBattleHealingItem } from './pokemon-trainer-battle-healing-item.runtime';

export type PokemonTrainerBattleMedicineItemRuntimeResult =
  | {
      readonly kind: 'hp';
      readonly battleId: string;
      readonly participantId: string;
      readonly trainerId: PokemonTrainerId;
      readonly itemId: PokemonItemId;
      readonly targetPokemonInstanceId: string;
      readonly previousHp: number;
      readonly currentHp: number;
      readonly appliedHealing: number;
      readonly trainerState: PokemonTrainerState;
    }
  | {
      readonly kind: 'status-cure';
      readonly battleId: string;
      readonly participantId: string;
      readonly trainerId: PokemonTrainerId;
      readonly itemId: PokemonItemId;
      readonly targetPokemonInstanceId: string;
      readonly curedMajorStatus: BattleMajorStatusCondition | null;
      readonly curedConfusion: boolean;
      readonly trainerState: PokemonTrainerState;
    };

export interface ApplyPokemonTrainerBattleMedicineItemInput {
  readonly session: PokemonBattleSession;
  readonly entry: BattleTurnResolutionEntry;
  readonly playerId: string;
  readonly trainerStateStore: PokemonTrainerStateStore;
  readonly trainerService: PokemonTrainerService;
  readonly medicineRepository?: PokemonOverworldItemRepository;
}

export async function applyPokemonTrainerBattleMedicineItem(
  input: ApplyPokemonTrainerBattleMedicineItemInput,
): Promise<PokemonTrainerBattleMedicineItemRuntimeResult> {
  const {
    session,
    entry,
    playerId,
    trainerStateStore,
    trainerService,
    medicineRepository,
  } = input;

  if (entry.command.action.type !== 'use-item') {
    throw new Error(
      `Battle command "${entry.command.action.type}" cannot be resolved by medicine item runtime`,
    );
  }

  const action = entry.command.action;
  const trainerBinding = session.trainerBindings.find(
    (binding) => binding.playerId === playerId,
  );

  if (!trainerBinding) {
    throw new Error(
      `Player "${playerId}" is not bound to battle "${session.battle.battleId}"`,
    );
  }

  if (trainerBinding.participantId !== entry.command.participantId) {
    throw new Error(
      `Player "${playerId}" cannot use item for participant "${entry.command.participantId}"`,
    );
  }

  const trainerState = trainerStateStore.get(trainerBinding.trainerId);

  if (!trainerState) {
    throw new Error(
      `Pokémon Trainer state not found for trainer "${trainerBinding.trainerId}"`,
    );
  }

  const plan = planBattleTrainerMedicineItemUse(
    session.battle,
    trainerBinding.participantId,
    action,
    trainerState.inventory,
  );

  if (plan.kind === 'hp') {
    const result = await applyPokemonTrainerBattleHealingItem({
      session,
      entry,
      playerId,
      trainerStateStore,
      trainerService,
    });

    return {
      kind: 'hp',
      battleId: result.battleId,
      participantId: result.participantId,
      trainerId: result.trainerId,
      itemId: result.itemId,
      targetPokemonInstanceId: result.targetPokemonInstanceId,
      previousHp: result.previousHp,
      currentHp: result.currentHp,
      appliedHealing: result.appliedHealing,
      trainerState: result.trainerState,
    };
  }

  if (!medicineRepository) {
    throw new Error(
      'Battle medicine repository is required for status cure items',
    );
  }

  const participant = session.battle.participants.find(
    (candidate) => candidate.id === trainerBinding.participantId,
  );

  if (!participant || participant.type !== 'trainer') {
    throw new Error(
      `Trainer participant "${trainerBinding.participantId}" not found in battle`,
    );
  }

  const battleTarget = participant.pokemon.find(
    (state) =>
      state.pokemon.instanceId === plan.targetPokemonInstanceId,
  );

  if (!battleTarget) {
    throw new Error(
      `Target Pokémon "${plan.targetPokemonInstanceId}" not found in battle`,
    );
  }

  const trainerTarget = trainerState.party.pokemon.find(
    (pokemon) => pokemon.instanceId === plan.targetPokemonInstanceId,
  );

  if (!trainerTarget) {
    throw new Error(
      `Target Pokémon "${plan.targetPokemonInstanceId}" not found in Trainer Party`,
    );
  }

  const durableMajorStatus = trainerTarget.majorStatus ?? null;
  const clearDurableMajorStatus =
    plan.curedMajorStatus !== null &&
    durableMajorStatus?.type === plan.curedMajorStatus;

  const updatedInventory = consumePokemonInventoryItem(
    trainerState.inventory,
    action.itemId,
    1,
  );

  const updatedParty = clearDurableMajorStatus
    ? {
        ...trainerState.party,
        pokemon: trainerState.party.pokemon.map((pokemon) =>
          pokemon.instanceId === plan.targetPokemonInstanceId
            ? {
                ...pokemon,
                majorStatus: null,
              }
            : pokemon,
        ),
      }
    : trainerState.party;

  /* DB FIRST: inventory decrement + durable status clear are atomic. */
  await medicineRepository.applyStatusCureItemUse({
    trainerId: trainerBinding.trainerId,
    itemId: action.itemId,
    targetPokemonInstanceId: plan.targetPokemonInstanceId,
    expectedMajorStatus: durableMajorStatus,
    clearMajorStatus: clearDurableMajorStatus,
  });

  /* RAM SECOND. */
  const updatedTrainerState = trainerStateStore.setPartyAndInventory(
    trainerBinding.trainerId,
    updatedParty,
    updatedInventory,
  );

  /* Battle runtime mutates only after persistence succeeds. */
  const statusState = ensureBattlePokemonStatusState(battleTarget);

  if (plan.curedMajorStatus !== null) {
    statusState.major = null;
  }

  if (plan.curedConfusion) {
    statusState.confusion = null;
  }

  return {
    kind: 'status-cure',
    battleId: session.battle.battleId,
    participantId: trainerBinding.participantId,
    trainerId: trainerBinding.trainerId,
    itemId: action.itemId,
    targetPokemonInstanceId: plan.targetPokemonInstanceId,
    curedMajorStatus: plan.curedMajorStatus,
    curedConfusion: plan.curedConfusion,
    trainerState: updatedTrainerState,
  };
}
