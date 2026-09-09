import { Injectable } from '@nestjs/common';

import {
  calculatePokemonMaxHp,
  consumePokemonInventoryItem,
  getPokemonInventoryItemQuantity,
  getPokemonItem,
} from '@cesar-mmo/shared';

import type {
  PokemonItemId,
  PokemonOverworldItemErrorCode,
  PokemonTrainerState,
} from '@cesar-mmo/shared';

import type { PokemonTrainerId } from '../pokemon-trainer-identity';

import { PokemonTrainerStateStore } from '../pokemon-trainer-state.store';

import {
  PokemonOverworldItemPersistenceConflictError,
  PokemonOverworldItemRepository,
} from './pokemon-overworld-item.repository';

export class PokemonOverworldItemUseError extends Error {
  constructor(
    public readonly code: PokemonOverworldItemErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PokemonOverworldItemUseError';
  }
}

export interface UsePokemonOverworldItemInput {
  readonly trainerId: PokemonTrainerId;
  readonly itemId: PokemonItemId;
  readonly targetPokemonInstanceId: string;
}

export interface UsePokemonOverworldItemResult {
  readonly trainerState: PokemonTrainerState;
  readonly itemId: PokemonItemId;
  readonly targetPokemonInstanceId: string;
  readonly previousHp: number;
  readonly currentHp: number;
  readonly appliedHealing: number;
}

@Injectable()
export class PokemonOverworldItemService {
  /*
   * Serializamos mutaciones por Trainer.
   *
   * Esto evita que dos clicks / packets
   * concurrentes calculen desde el mismo
   * TrainerState RAM.
   */
  private readonly operationQueues = new Map<PokemonTrainerId, Promise<void>>();

  constructor(
    private readonly trainerStateStore: PokemonTrainerStateStore,

    private readonly repository: PokemonOverworldItemRepository,
  ) {}

  public useItem(
    input: UsePokemonOverworldItemInput,
  ): Promise<UsePokemonOverworldItemResult> {
    return this.enqueue(input.trainerId, () => this.executeUseItem(input));
  }

  private async executeUseItem(
    input: UsePokemonOverworldItemInput,
  ): Promise<UsePokemonOverworldItemResult> {
    const { trainerId, itemId, targetPokemonInstanceId } = input;

    /* 1. Authoritative runtime TrainerState */
    const trainerState = this.trainerStateStore.get(trainerId);

    if (!trainerState) {
      throw new PokemonOverworldItemUseError(
        'INCOMPATIBLE_STATE',
        `Pokémon Trainer state not found for trainer "${trainerId}"`,
      );
    }

    /* 2. Item definition */
    const item = getPokemonItem(itemId);

    if (!item.overworldUsable) {
      throw new PokemonOverworldItemUseError(
        'ITEM_NOT_USABLE',
        `Pokémon item "${itemId}" cannot be used in the overworld`,
      );
    }

    /* Overworld HP items soportados actualmente: heal-hp */
    if (
      !item.effect ||
      (item.effect.type !== 'heal-hp' && item.effect.type !== 'revive')
    ) {
      throw new PokemonOverworldItemUseError(
        'ITEM_NOT_USABLE',
        `Pokémon item "${itemId}" is not a supported overworld HP item`,
      );
    }

    /* 3. Inventory authority */
    const quantity = getPokemonInventoryItemQuantity(
      trainerState.inventory,
      itemId,
    );

    if (quantity <= 0) {
      throw new PokemonOverworldItemUseError(
        'ITEM_NOT_AVAILABLE',
        `Pokémon item "${itemId}" is not available`,
      );
    }

    /*
     * 4. Target must belong to current Party.
     * Storage Pokémon cannot be targeted from the normal overworld Inventory UI.
     */
    const target = trainerState.party.pokemon.find(
      (pokemon) => pokemon.instanceId === targetPokemonInstanceId,
    );

    if (!target) {
      throw new PokemonOverworldItemUseError(
        'INVALID_TARGET',
        `Pokémon "${targetPokemonInstanceId}" is not in trainer "${trainerId}" Party`,
      );
    }

    /* 5. Resolve authoritative HP mutation */
    const maxHp = calculatePokemonMaxHp(target);
    const previousHp = target.currentHp;

    let currentHp: number;

    if (item.effect.type === 'heal-hp') {
      /* Potion / Super Potion / Hyper Potion / Max Potion nunca pueden revivir */
      if (previousHp <= 0) {
        throw new PokemonOverworldItemUseError(
          'TARGET_FAINTED',
          `Pokémon "${targetPokemonInstanceId}" is fainted`,
        );
      }

      if (previousHp >= maxHp) {
        throw new PokemonOverworldItemUseError(
          'TARGET_FULL_HP',
          `Pokémon "${targetPokemonInstanceId}" already has full HP`,
        );
      }

      if (item.effect.mode === 'full') {
        currentHp = maxHp;
      } else {
        currentHp = Math.min(maxHp, previousHp + item.effect.amount);
      }
    } else {
      /* Revive / Max Revive solamente pueden utilizarse sobre un Pokémon debilitado. */
      if (previousHp > 0) {
        throw new PokemonOverworldItemUseError(
          'TARGET_NOT_FAINTED',
          `Pokémon "${targetPokemonInstanceId}" is not fainted`,
        );
      }

      if (item.effect.mode === 'full') {
        currentHp = maxHp;
      } else {
        currentHp = Math.max(1, Math.floor(maxHp / 2));
      }
    }

    const appliedHealing = currentHp - previousHp;

    /* 6. Calculate next RAM state BEFORE DB, but DO NOT commit it to RAM yet */
    const updatedParty = {
      pokemon: trainerState.party.pokemon.map((pokemon) =>
        pokemon.instanceId === targetPokemonInstanceId
          ? {
              ...pokemon,
              currentHp,
            }
          : pokemon,
      ),
    };

    const updatedInventory = consumePokemonInventoryItem(
      trainerState.inventory,
      itemId,
      1,
    );

    /* 7. PostgreSQL FIRST. Item dec + HP mutation belong to one transaction */
    try {
      await this.repository.applyHpItemUse({
        trainerId,
        itemId,
        targetPokemonInstanceId,
        currentHp,
      });
    } catch (error: unknown) {
      if (error instanceof PokemonOverworldItemPersistenceConflictError) {
        throw new PokemonOverworldItemUseError(error.code, error.message);
      }

      console.error('[PokemonOverworldItem] persistence failed', {
        trainerId,
        itemId,
        targetPokemonInstanceId,
        error,
      });

      throw new PokemonOverworldItemUseError(
        'PERSISTENCE_FAILED',
        'Failed to persist Pokémon overworld item use',
      );
    }

    /* 8. RAM SECOND. Sólo llegamos aquí después del COMMIT */
    const updatedTrainerState = this.trainerStateStore.setPartyAndInventory(
      trainerId,
      updatedParty,
      updatedInventory,
    );

    return {
      trainerState: updatedTrainerState,
      itemId,
      targetPokemonInstanceId,
      previousHp,
      currentHp,
      appliedHealing,
    };
  }

  private enqueue<T>(
    trainerId: PokemonTrainerId,
    operation: () => Promise<T>,
  ): Promise<T> {
    const previous = this.operationQueues.get(trainerId) ?? Promise.resolve();

    const current = previous.catch(() => undefined).then(operation);

    const tail: Promise<void> = current.then(
      () => undefined,
      () => undefined,
    );

    this.operationQueues.set(trainerId, tail);

    void tail.finally(() => {
      if (this.operationQueues.get(trainerId) === tail) {
        this.operationQueues.delete(trainerId);
      }
    });

    return current;
  }
}
