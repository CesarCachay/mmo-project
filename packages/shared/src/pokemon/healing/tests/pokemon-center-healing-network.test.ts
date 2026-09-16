import { describe, expect, it } from "vitest";

import {
  isPokemonCenterHealInput,
  isPokemonCenterHealedPayload,
  isPokemonCenterHealingErrorPayload,
} from "../pokemon-center-healing-network.js";

describe("Pokémon Center Healing network contract", () => {
  it("accepts only an exact non-empty healing station request", () => {
    expect(
      isPokemonCenterHealInput({
        healingStationId: "pokemon-center-healing-station",
      })
    ).toBe(true);

    expect(isPokemonCenterHealInput(undefined)).toBe(false);

    expect(isPokemonCenterHealInput({})).toBe(false);

    expect(
      isPokemonCenterHealInput({
        healingStationId: "",
      })
    ).toBe(false);

    expect(
      isPokemonCenterHealInput({
        healingStationId: "   ",
      })
    ).toBe(false);

    expect(
      isPokemonCenterHealInput({
        healingStationId: "pokemon-center-healing-station",

        trainerId: "client-must-not-send-this",
      })
    ).toBe(false);
  });

  it("accepts valid healing results including an already healthy Party and rejects invalid counters", () => {
    expect(
      isPokemonCenterHealedPayload({
        healingStationId: "pokemon-center-healing-station",

        restoredPokemonCount: 2,

        totalHpRestored: 48,

        totalPpRestored: 37,
      })
    ).toBe(true);

    /*
     * Pokémon Center can be used while the
     * entire Party is already fully healed.
     */
    expect(
      isPokemonCenterHealedPayload({
        healingStationId: "pokemon-center-healing-station",

        restoredPokemonCount: 0,

        totalHpRestored: 0,

        totalPpRestored: 0,
      })
    ).toBe(true);

    /*
     * Party cannot contain more than six
     * Pokémon.
     */
    expect(
      isPokemonCenterHealedPayload({
        healingStationId: "pokemon-center-healing-station",

        restoredPokemonCount: 7,

        totalHpRestored: 10,

        totalPpRestored: 10,
      })
    ).toBe(false);

    expect(
      isPokemonCenterHealedPayload({
        healingStationId: "pokemon-center-healing-station",

        restoredPokemonCount: 1,

        totalHpRestored: -1,

        totalPpRestored: 10,
      })
    ).toBe(false);

    expect(
      isPokemonCenterHealedPayload({
        healingStationId: "pokemon-center-healing-station",

        restoredPokemonCount: 1,

        totalHpRestored: 10,

        totalPpRestored: 10,

        unexpected: true,
      })
    ).toBe(false);
  });

  it("accepts only supported healing error codes with the exact payload shape", () => {
    const supportedCodes = [
      "INVALID_INPUT",
      "HEALING_NOT_AVAILABLE",
      "INCOMPATIBLE_STATE",
      "PERSISTENCE_CONFLICT",
      "PERSISTENCE_FAILED",
    ] as const;

    for (const code of supportedCodes) {
      expect(
        isPokemonCenterHealingErrorPayload({
          code,
        })
      ).toBe(true);
    }

    expect(
      isPokemonCenterHealingErrorPayload({
        code: "TRAINER_STATE_NOT_FOUND",
      })
    ).toBe(false);

    expect(
      isPokemonCenterHealingErrorPayload({
        code: "HEALING_NOT_AVAILABLE",

        message: "extra network field",
      })
    ).toBe(false);

    expect(isPokemonCenterHealingErrorPayload({})).toBe(false);
  });
});
