import { describe, expect, it } from "vitest";

import { isPokemonBattleStartedPayload } from "../src/pokemon/battles/pokemon-battle-network.js";

function createPokemon(instanceId: string) {
  return {
    instanceId,
    speciesId: 25,
    formId: 25,
    level: 10,
    experience: 0,
    currentHp: 30,
    abilityId: 9,
    moves: [
      {
        moveId: 33,
        currentPp: 35,
      },
    ],
  };
}

function createParticipant(
  id: string,
  type: "trainer" | "wild",
  side: "side-a" | "side-b",
  pokemonInstanceIds: readonly string[],
  displayName?: string
) {
  return {
    id,
    type,
    side,
    ...(displayName !== undefined ? { displayName } : {}),
    activePokemonIndex: 0,
    pokemon: pokemonInstanceIds.map((instanceId) => ({
      pokemon: createPokemon(instanceId),
      currentHp: 30,
    })),
  };
}

describe("isPokemonBattleStartedPayload", () => {
  it("accepts the existing Wild Battle shape", () => {
    const payload = {
      battle: {
        battleId: "battle-wild-1",
        type: "wild",
        status: "active",
        participants: [
          createParticipant("trainer-a", "trainer", "side-a", ["party-1"]),
          createParticipant("wild-b", "wild", "side-b", ["wild-1"]),
        ],
      },
      localParticipantId: "trainer-a",
    };

    expect(isPokemonBattleStartedPayload(payload)).toBe(true);
  });

  it("accepts a Trainer Battle with one trainer on each side", () => {
    const payload = {
      battle: {
        battleId: "battle-trainer-1",
        type: "trainer",
        status: "active",
        participants: [
          createParticipant("trainer-a", "trainer", "side-a", ["party-1", "party-2"]),
          createParticipant("trainer-b", "trainer", "side-b", ["npc-1", "npc-2"]),
        ],
      },
      localParticipantId: "trainer-a",
    };

    expect(isPokemonBattleStartedPayload(payload)).toBe(true);
  });

  it("rejects a Trainer Battle that still contains a Wild participant", () => {
    const payload = {
      battle: {
        battleId: "battle-trainer-invalid",
        type: "trainer",
        status: "active",
        participants: [
          createParticipant("trainer-a", "trainer", "side-a", ["party-1"]),
          createParticipant("wild-b", "wild", "side-b", ["wild-1"]),
        ],
      },
      localParticipantId: "trainer-a",
    };

    expect(isPokemonBattleStartedPayload(payload)).toBe(false);
  });

  it("rejects duplicated participant sides", () => {
    const payload = {
      battle: {
        battleId: "battle-trainer-invalid-sides",
        type: "trainer",
        status: "active",
        participants: [
          createParticipant("trainer-a", "trainer", "side-a", ["party-1"]),
          createParticipant("trainer-b", "trainer", "side-a", ["npc-1"]),
        ],
      },
      localParticipantId: "trainer-a",
    };

    expect(isPokemonBattleStartedPayload(payload)).toBe(false);
  });

  it("rejects duplicated participant ids", () => {
    const payload = {
      battle: {
        battleId: "battle-trainer-invalid-ids",
        type: "trainer",
        status: "active",
        participants: [
          createParticipant("trainer", "trainer", "side-a", ["party-1"]),
          createParticipant("trainer", "trainer", "side-b", ["npc-1"]),
        ],
      },
      localParticipantId: "trainer",
    };

    expect(isPokemonBattleStartedPayload(payload)).toBe(false);
  });
  it("rejects a localParticipantId that does not identify a trainer participant", () => {
    const payload = {
      battle: {
        battleId: "battle-wild-invalid-local",
        type: "wild",
        status: "active",
        participants: [
          createParticipant("trainer-a", "trainer", "side-a", ["party-1"]),
          createParticipant("wild-b", "wild", "side-b", ["wild-1"]),
        ],
      },
      localParticipantId: "wild-b",
    };

    expect(isPokemonBattleStartedPayload(payload)).toBe(false);
  });

  it("accepts a non-empty participant displayName", () => {
    const payload = {
      battle: {
        battleId: "battle-trainer-display-name",
        type: "trainer",
        status: "active",
        participants: [
          createParticipant("trainer-a", "trainer", "side-a", ["party-1"]),
          createParticipant(
            "trainer-b",
            "trainer",
            "side-b",
            ["npc-1"],
            "Gary"
          ),
        ],
      },
      localParticipantId: "trainer-a",
    };

    expect(isPokemonBattleStartedPayload(payload)).toBe(true);
  });

  it("rejects an invalid participant displayName", () => {
    const payload = {
      battle: {
        battleId: "battle-trainer-invalid-display-name",
        type: "trainer",
        status: "active",
        participants: [
          createParticipant("trainer-a", "trainer", "side-a", ["party-1"]),
          createParticipant(
            "trainer-b",
            "trainer",
            "side-b",
            ["npc-1"],
            "   "
          ),
        ],
      },
      localParticipantId: "trainer-a",
    };

    expect(isPokemonBattleStartedPayload(payload)).toBe(false);
  });

});
