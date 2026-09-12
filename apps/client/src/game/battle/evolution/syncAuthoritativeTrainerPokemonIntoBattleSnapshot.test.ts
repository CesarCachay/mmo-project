import { describe, expect, it } from "vitest";

import type { BattleInstance, PokemonInstance } from "@cesar-mmo/shared";

import { syncAuthoritativeTrainerPokemonIntoBattleSnapshot } from "./syncAuthoritativeTrainerPokemonIntoBattleSnapshot";

const sourcePokemon: PokemonInstance = {
  instanceId: "pokemon-a",
  speciesId: 4,
  formId: 4,
  level: 16,
  experience: 2500,
  currentHp: 40,
  abilityId: 1,
  moves: [
    {
      moveId: 10,
      currentPp: 30,
    },
  ],
};

const evolvedPokemon: PokemonInstance = {
  ...sourcePokemon,
  speciesId: 5,
  formId: 5,
  /*
   * Deliberately different from
   * Battle runtime HP.
   */
  currentHp: 55,
  abilityId: 66,
};

const benchedPokemon: PokemonInstance = {
  instanceId: "pokemon-b",
  speciesId: 7,
  formId: 7,
  level: 12,
  experience: 1000,
  currentHp: 30,
  abilityId: 67,
  moves: [
    {
      moveId: 20,
      currentPp: 25,
    },
  ],
};

const wildPokemon: PokemonInstance = {
  instanceId: "wild-a",
  speciesId: 19,
  formId: 19,
  level: 8,
  experience: 0,
  currentHp: 20,
  abilityId: 50,
  moves: [
    {
      moveId: 33,
      currentPp: 35,
    },
  ],
};

function createBattle(): BattleInstance {
  return {
    battleId: "battle-test",
    type: "wild",
    status: "active",
    participants: [
      {
        id: "trainer-participant",
        type: "trainer",
        side: "side-a",
        activePokemonIndex: 0,
        pokemon: [
          {
            pokemon: sourcePokemon,
            /*
             * Runtime Battle HP is 17.
             */
            currentHp: 17,
          },
          {
            pokemon: benchedPokemon,
            currentHp: 30,
          },
        ],
      },
      {
        id: "wild-participant",
        type: "wild",
        side: "side-b",
        activePokemonIndex: 0,
        pokemon: [
          {
            pokemon: wildPokemon,
            currentHp: 11,
          },
        ],
      },
    ],
  };
}

describe("syncAuthoritativeTrainerPokemonIntoBattleSnapshot", () => {
  it("replaces the Trainer PokemonInstance while preserving Battle runtime state", () => {
    const battle = createBattle();

    const result = syncAuthoritativeTrainerPokemonIntoBattleSnapshot(
      battle,
      evolvedPokemon,
    );

    const trainer = result.participants.find(
      (participant) => participant.type === "trainer",
    );

    expect(trainer).toBeDefined();

    const syncedPokemon = trainer?.pokemon[0];

    expect(syncedPokemon?.pokemon.speciesId).toBe(5);

    expect(syncedPokemon?.pokemon.formId).toBe(5);

    expect(syncedPokemon?.pokemon.abilityId).toBe(66);

    /*
     * Battle runtime HP MUST win.
     */
    expect(syncedPokemon?.currentHp).toBe(17);

    /*
     * Persistent instance itself
     * still carries its authoritative
     * TrainerState value.
     */
    expect(syncedPokemon?.pokemon.currentHp).toBe(55);

    expect(trainer?.activePokemonIndex).toBe(0);
  });

  it("does not mutate the original Battle snapshot", () => {
    const battle = createBattle();

    const result = syncAuthoritativeTrainerPokemonIntoBattleSnapshot(
      battle,
      evolvedPokemon,
    );

    const originalTrainer = battle.participants.find(
      (participant) => participant.type === "trainer",
    );

    const syncedTrainer = result.participants.find(
      (participant) => participant.type === "trainer",
    );

    expect(originalTrainer?.pokemon[0]?.pokemon.speciesId).toBe(4);

    expect(syncedTrainer?.pokemon[0]?.pokemon.speciesId).toBe(5);

    expect(result).not.toBe(battle);
  });

  it("does not modify the Wild participant", () => {
    const battle = createBattle();

    const originalWild = battle.participants.find(
      (participant) => participant.type === "wild",
    );

    const result = syncAuthoritativeTrainerPokemonIntoBattleSnapshot(
      battle,
      evolvedPokemon,
    );

    const resultingWild = result.participants.find(
      (participant) => participant.type === "wild",
    );

    expect(resultingWild).toBe(originalWild);

    expect(resultingWild?.pokemon[0]?.currentHp).toBe(11);
  });

  it("returns the original Battle when the Pokémon is not present", () => {
    const battle = createBattle();

    const unknownPokemon: PokemonInstance = {
      ...evolvedPokemon,
      instanceId: "not-in-battle",
    };

    const result = syncAuthoritativeTrainerPokemonIntoBattleSnapshot(
      battle,
      unknownPokemon,
    );

    expect(result).toBe(battle);
  });
});
