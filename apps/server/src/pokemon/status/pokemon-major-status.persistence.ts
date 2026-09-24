import {
  createPokemonPersistentMajorStatusState,
  isPokemonMajorStatusCondition,
  type PokemonPersistentMajorStatusState,
} from '@cesar-mmo/shared';

export interface PokemonMajorStatusPersistenceFields {
  readonly majorStatus: string | null;
  readonly statusTurnsRemaining: number | null;
}

export function toPokemonMajorStatusPersistenceFields(
  status: PokemonPersistentMajorStatusState | null | undefined,
): PokemonMajorStatusPersistenceFields {
  if (!status) {
    return {
      majorStatus: null,
      statusTurnsRemaining: null,
    };
  }

  return {
    majorStatus: status.type,
    statusTurnsRemaining:
      status.type === 'sleep' ? status.turnsRemaining : null,
  };
}

export function fromPokemonMajorStatusPersistenceFields(
  majorStatus: string | null,
  statusTurnsRemaining: number | null,
): PokemonPersistentMajorStatusState | null {
  if (majorStatus === null) {
    if (statusTurnsRemaining !== null) {
      throw new Error(
        'Persisted Pokémon has statusTurnsRemaining without a majorStatus',
      );
    }

    return null;
  }

  if (!isPokemonMajorStatusCondition(majorStatus)) {
    throw new Error(`Unknown persisted Pokémon major status "${majorStatus}"`);
  }

  if (majorStatus === 'sleep') {
    if (
      !Number.isInteger(statusTurnsRemaining) ||
      statusTurnsRemaining === null ||
      statusTurnsRemaining <= 0
    ) {
      throw new Error(
        `Persisted sleep status requires positive turnsRemaining, received "${statusTurnsRemaining}"`,
      );
    }

    return createPokemonPersistentMajorStatusState(
      majorStatus,
      statusTurnsRemaining,
    );
  }

  if (statusTurnsRemaining !== null) {
    throw new Error(
      `Persisted major status "${majorStatus}" cannot carry statusTurnsRemaining`,
    );
  }

  return createPokemonPersistentMajorStatusState(majorStatus);
}
