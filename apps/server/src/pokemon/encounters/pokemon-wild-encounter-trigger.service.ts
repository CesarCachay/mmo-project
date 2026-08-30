import type { ServerMapEncounterZone } from 'src/game/maps/serverMapRegistry';

const ENCOUNTER_DISTANCE_PER_ROLL_PX = 16;

const ENCOUNTER_SUCCESS_CHANCE = 0.1;

const ENCOUNTER_COOLDOWN_DISTANCE_PX = 64;

type EncounterTriggerRng = () => number;

type PlayerEncounterTriggerState = {
  currentZoneId?: string;

  distanceSinceLastRoll: number;

  cooldownDistanceRemaining: number;
};

export type PokemonWildEncounterTrigger = {
  readonly zoneId: string;

  readonly encounterTableId: ServerMapEncounterZone['encounterTableId'];
};

export class PokemonWildEncounterTriggerService {
  private readonly playerStates = new Map<
    string,
    PlayerEncounterTriggerState
  >();

  constructor(private readonly rng: EncounterTriggerRng = Math.random) {}

  update(
    playerId: string,
    zone: ServerMapEncounterZone | undefined,
    movedDistance: number,
  ): PokemonWildEncounterTrigger | undefined {
    if (!Number.isFinite(movedDistance) || movedDistance < 0) {
      throw new Error(
        `Encounter movedDistance must be a finite number >= 0. Received: ${movedDistance}`,
      );
    }

    const state = this.getOrCreateState(playerId);

    if (!zone) {
      state.currentZoneId = undefined;
      state.distanceSinceLastRoll = 0;

      return undefined;
    }

    if (state.currentZoneId !== zone.id) {
      state.currentZoneId = zone.id;
      state.distanceSinceLastRoll = 0;
    }

    if (movedDistance === 0) {
      return undefined;
    }

    let eligibleDistance = movedDistance;

    if (state.cooldownDistanceRemaining > 0) {
      const consumedCooldownDistance = Math.min(
        eligibleDistance,
        state.cooldownDistanceRemaining,
      );

      state.cooldownDistanceRemaining -= consumedCooldownDistance;

      eligibleDistance -= consumedCooldownDistance;

      if (eligibleDistance <= 0) {
        return undefined;
      }
    }

    state.distanceSinceLastRoll += eligibleDistance;

    while (state.distanceSinceLastRoll >= ENCOUNTER_DISTANCE_PER_ROLL_PX) {
      state.distanceSinceLastRoll -= ENCOUNTER_DISTANCE_PER_ROLL_PX;

      if (!this.rollEncounter()) {
        continue;
      }

      state.distanceSinceLastRoll = 0;

      state.cooldownDistanceRemaining = ENCOUNTER_COOLDOWN_DISTANCE_PX;

      return {
        zoneId: zone.id,
        encounterTableId: zone.encounterTableId,
      };
    }

    return undefined;
  }

  reset(playerId: string): void {
    this.playerStates.delete(playerId);
  }

  private getOrCreateState(playerId: string): PlayerEncounterTriggerState {
    const existingState = this.playerStates.get(playerId);

    if (existingState) {
      return existingState;
    }

    const newState: PlayerEncounterTriggerState = {
      currentZoneId: undefined,
      distanceSinceLastRoll: 0,
      cooldownDistanceRemaining: 0,
    };

    this.playerStates.set(playerId, newState);

    return newState;
  }

  private rollEncounter(): boolean {
    const randomValue = this.rng();

    if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
      throw new Error(
        `Encounter RNG must return a finite value >= 0 and < 1. Received: ${randomValue}`,
      );
    }

    return randomValue < ENCOUNTER_SUCCESS_CHANCE;
  }
}
