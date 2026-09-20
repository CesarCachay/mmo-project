import type {
  BattleFieldState,
  BattleInstance,
  BattleParticipantId,
  BattleSide,
  BattleSideHazards,
  BattleWeatherType,
} from "./pokemon-battle.types.js";

const FIELD_DURATION_TURNS = 5;

export const PERSISTENT_BATTLEFIELD_MOVE_IDS = {
  SPIKES: 191,
  SANDSTORM: 201,
  RAIN_DANCE: 240,
  SUNNY_DAY: 241,
  HAIL: 258,
  GRAVITY: 356,
  TOXIC_SPIKES: 390,
  TRICK_ROOM: 433,
  STEALTH_ROCK: 446,
} as const;

export function createEmptyBattleSideHazards(): BattleSideHazards {
  return {
    spikesLayers: 0,
    toxicSpikesLayers: 0,
    stealthRock: false,
  };
}

export function createEmptyBattleFieldState(): BattleFieldState {
  return {
    weather: null,
    hazards: {
      "side-a": createEmptyBattleSideHazards(),
      "side-b": createEmptyBattleSideHazards(),
    },
    effects: {
      trickRoomRemainingTurns: 0,
      gravityRemainingTurns: 0,
    },
  };
}

export function ensureBattleFieldState(battle: BattleInstance): BattleFieldState {
  battle.fieldState ??= createEmptyBattleFieldState();
  return battle.fieldState;
}

/**
 * Applies only the persistent battlefield portion of a move.
 * Damage/status resolution remains owned by the regular battle executor.
 */
export function applyPersistentBattlefieldMove(
  battle: BattleInstance,
  actorParticipantId: BattleParticipantId,
  moveId: number,
): boolean {
  const fieldState = ensureBattleFieldState(battle);

  switch (moveId) {
    case PERSISTENT_BATTLEFIELD_MOVE_IDS.RAIN_DANCE:
      setWeather(fieldState, "rain");
      return true;

    case PERSISTENT_BATTLEFIELD_MOVE_IDS.SUNNY_DAY:
      setWeather(fieldState, "sun");
      return true;

    case PERSISTENT_BATTLEFIELD_MOVE_IDS.SANDSTORM:
      setWeather(fieldState, "sandstorm");
      return true;

    case PERSISTENT_BATTLEFIELD_MOVE_IDS.HAIL:
      setWeather(fieldState, "hail");
      return true;

    case PERSISTENT_BATTLEFIELD_MOVE_IDS.TRICK_ROOM:
      fieldState.effects.trickRoomRemainingTurns =
        fieldState.effects.trickRoomRemainingTurns > 0
          ? 0
          : FIELD_DURATION_TURNS;
      return true;

    case PERSISTENT_BATTLEFIELD_MOVE_IDS.GRAVITY:
      fieldState.effects.gravityRemainingTurns = FIELD_DURATION_TURNS;
      return true;

    case PERSISTENT_BATTLEFIELD_MOVE_IDS.SPIKES: {
      const hazards = getOpponentHazards(battle, actorParticipantId, fieldState);
      hazards.spikesLayers = Math.min(3, hazards.spikesLayers + 1);
      return true;
    }

    case PERSISTENT_BATTLEFIELD_MOVE_IDS.TOXIC_SPIKES: {
      const hazards = getOpponentHazards(battle, actorParticipantId, fieldState);
      hazards.toxicSpikesLayers = Math.min(2, hazards.toxicSpikesLayers + 1);
      return true;
    }

    case PERSISTENT_BATTLEFIELD_MOVE_IDS.STEALTH_ROCK: {
      const hazards = getOpponentHazards(battle, actorParticipantId, fieldState);
      hazards.stealthRock = true;
      return true;
    }

    default:
      return false;
  }
}

/**
 * Advances timed field effects exactly once when the battle advances to the
 * next turn. Hazards persist until battle end (or a future removal mechanic).
 */
export function advanceBattleFieldStateTurn(battle: BattleInstance): void {
  const fieldState = battle.fieldState;

  if (!fieldState) {
    return;
  }

  if (fieldState.weather) {
    fieldState.weather.remainingTurns -= 1;

    if (fieldState.weather.remainingTurns <= 0) {
      fieldState.weather = null;
    }
  }

  fieldState.effects.trickRoomRemainingTurns = decrementTurns(
    fieldState.effects.trickRoomRemainingTurns,
  );
  fieldState.effects.gravityRemainingTurns = decrementTurns(
    fieldState.effects.gravityRemainingTurns,
  );
}

export function hasPersistentBattleFieldEffects(
  fieldState: BattleFieldState | undefined,
): boolean {
  if (!fieldState) {
    return false;
  }

  if (fieldState.weather) {
    return true;
  }

  if (
    fieldState.effects.trickRoomRemainingTurns > 0 ||
    fieldState.effects.gravityRemainingTurns > 0
  ) {
    return true;
  }

  return (Object.keys(fieldState.hazards) as BattleSide[]).some((side) => {
    const hazards = fieldState.hazards[side];
    return (
      hazards.spikesLayers > 0 ||
      hazards.toxicSpikesLayers > 0 ||
      hazards.stealthRock
    );
  });
}

function setWeather(fieldState: BattleFieldState, type: BattleWeatherType): void {
  fieldState.weather = {
    type,
    remainingTurns: FIELD_DURATION_TURNS,
  };
}

function getOpponentHazards(
  battle: BattleInstance,
  actorParticipantId: BattleParticipantId,
  fieldState: BattleFieldState,
): BattleSideHazards {
  const actor = battle.participants.find(
    (participant) => participant.id === actorParticipantId,
  );

  if (!actor) {
    throw new Error(
      `Battle participant "${actorParticipantId}" not found in battle "${battle.battleId}"`,
    );
  }

  return fieldState.hazards[getOpposingSide(actor.side)];
}

function getOpposingSide(side: BattleSide): BattleSide {
  return side === "side-a" ? "side-b" : "side-a";
}

function decrementTurns(turns: number): number {
  return Math.max(0, turns - 1);
}
