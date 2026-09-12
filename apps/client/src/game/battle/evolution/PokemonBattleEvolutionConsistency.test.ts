import { describe, expect, it } from "vitest";

import type {
  BattleInstance,
  BattlePokemonState,
  PokemonEvolutionRequiredPayload,
  PokemonEvolutionResolvedPayload,
  PokemonInstance,
} from "@cesar-mmo/shared";

import { PokemonBattleEvolutionHudSyncCoordinator } from "./PokemonBattleEvolutionHudSyncCoordinator";

import { syncAuthoritativeTrainerPokemonIntoBattleSnapshot } from "./syncAuthoritativeTrainerPokemonIntoBattleSnapshot";

const activePokemonBeforeEvolution: PokemonInstance = {
  instanceId: "pokemon-active",
  speciesId: 4,
  formId: 4,
  level: 16,
  experience: 2500,
  currentHp: 40,
  abilityId: 66,
  moves: [
    {
      moveId: 10,
      currentPp: 30,
    },
  ],
};

const activePokemonAfterEvolution: PokemonInstance = {
  ...activePokemonBeforeEvolution,
  speciesId: 5,
  formId: 5,
  /*
   * Persistent TrainerState HP.
   *
   * Deliberately different from
   * Battle runtime HP.
   */
  currentHp: 55,
  abilityId: 67,
};

const benchPokemonBeforeEvolution: PokemonInstance = {
  instanceId: "pokemon-bench",
  speciesId: 7,
  formId: 7,
  level: 16,
  experience: 2500,
  currentHp: 35,
  abilityId: 44,
  moves: [
    {
      moveId: 20,
      currentPp: 25,
    },
  ],
};

const benchPokemonAfterEvolution: PokemonInstance = {
  ...benchPokemonBeforeEvolution,
  speciesId: 8,
  formId: 8,
  currentHp: 45,
  abilityId: 45,
};

const wildPokemon: PokemonInstance = {
  instanceId: "wild-pokemon",
  speciesId: 19,
  formId: 19,
  level: 10,
  experience: 0,
  currentHp: 24,
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
    battleId: "battle-evolution-consistency",
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
            pokemon: activePokemonBeforeEvolution,
            /*
             * Runtime Battle HP.
             */
            currentHp: 17,
          },
          {
            pokemon: benchPokemonBeforeEvolution,
            currentHp: 23,
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

function createEvolutionRequest(
  pokemonInstanceId: string,
  sourceSpeciesId: number,
  sourceFormId: number,
  targetSpeciesId: number,
  targetFormId: number,
): PokemonEvolutionRequiredPayload {
  return {
    pokemonInstanceId,
    sourceSpeciesId,
    sourceFormId,
    targetSpeciesId,
    targetFormId,
    triggerLevel: 16,
    revision: 0,
  };
}

function createEvolutionResolved(
  pokemonInstanceId: string,
  previousSpeciesId: number,
  previousFormId: number,
  currentSpeciesId: number,
  currentFormId: number,
): PokemonEvolutionResolvedPayload {
  return {
    pokemonInstanceId,
    resolvedRevision: 0,
    decision: {
      type: "accept",
    },
    evolution: {
      pokemonInstanceId,
      previousSpeciesId,
      previousFormId,
      currentSpeciesId,
      currentFormId,
    },
  };
}

describe("Battle Evolution state consistency", () => {
  it("keeps TrainerState, Battle snapshot and active HUD projection consistent after Evolution", async () => {
    const order: string[] = [];

    /*
     * This represents the latest
     * authoritative TRAINER_STATE.
     */
    const trainerState = {
      party: {
        pokemon: [activePokemonAfterEvolution, benchPokemonBeforeEvolution],
      },
    };

    let battleSnapshot = createBattle();

    let hudProjection: BattlePokemonState | undefined;

    let partyProjection: readonly BattlePokemonState[] = [];

    const request = createEvolutionRequest("pokemon-active", 4, 4, 5, 5);

    const coordinator = new PokemonBattleEvolutionHudSyncCoordinator({
      presentRequiredEvolution: async () =>
        createEvolutionResolved("pokemon-active", 4, 4, 5, 5),

      getTrainerState: () => trainerState,

      syncTrainerPokemonAfterEvolution: (evolvedPokemon, trainerParty) => {
        order.push("sync-start");

        /*
         * Same operation used by
         * BattleController in G3.1.
         */
        battleSnapshot = syncAuthoritativeTrainerPokemonIntoBattleSnapshot(
          battleSnapshot,
          evolvedPokemon.pokemon,
        );

        const trainer = battleSnapshot.participants.find(
          (participant) => participant.type === "trainer",
        );

        const battlePokemon = trainer?.pokemon.find(
          (state) =>
            state.pokemon.instanceId === evolvedPokemon.pokemon.instanceId,
        );

        hudProjection = battlePokemon ?? evolvedPokemon;

        partyProjection = trainerParty;

        order.push("sync-end");
      },

      finishEvolutionCinematic: () => {
        order.push("cinematic-finish");
      },
    });

    await coordinator.presentRequiredEvolution(request);

    /*
     * 1. TrainerState authority.
     */
    const authoritative = trainerState.party.pokemon[0];

    expect(authoritative).toBe(activePokemonAfterEvolution);

    expect(authoritative?.speciesId).toBe(5);

    expect(authoritative?.formId).toBe(5);

    /*
     * 2. Battle snapshot projection.
     */
    const trainer = battleSnapshot.participants.find(
      (participant) => participant.type === "trainer",
    );

    const battlePokemon = trainer?.pokemon[0];

    expect(battlePokemon?.pokemon).toBe(activePokemonAfterEvolution);

    expect(battlePokemon?.pokemon.speciesId).toBe(5);

    /*
     * Battle runtime HP is preserved.
     */
    expect(battlePokemon?.currentHp).toBe(17);

    /*
     * TrainerState PokemonInstance HP
     * remains independently authoritative.
     */
    expect(battlePokemon?.pokemon.currentHp).toBe(55);

    /*
     * 3. HUD projection.
     */
    expect(hudProjection?.pokemon).toBe(activePokemonAfterEvolution);

    expect(hudProjection?.pokemon.speciesId).toBe(5);

    expect(hudProjection?.pokemon.formId).toBe(5);

    expect(hudProjection?.currentHp).toBe(17);

    /*
     * 4. Party presentation also uses
     * authoritative TrainerState.
     */
    expect(partyProjection[0]?.pokemon).toBe(activePokemonAfterEvolution);

    /*
     * 5. HUD sync must finish before
     * cinematic is released.
     */
    expect(order).toEqual(["sync-start", "sync-end", "cinematic-finish"]);
  });

  it("updates an evolved benched Pokémon without replacing the active Battle HUD", async () => {
    const order: string[] = [];

    const trainerState = {
      party: {
        pokemon: [activePokemonBeforeEvolution, benchPokemonAfterEvolution],
      },
    };

    let battleSnapshot = createBattle();

    /*
     * The HUD is currently displaying
     * the active Pokémon.
     */
    let activeHudProjection: BattlePokemonState =
      battleSnapshot.participants[0]!.pokemon[0]!;

    let partyProjection: readonly BattlePokemonState[] = [];

    const request = createEvolutionRequest("pokemon-bench", 7, 7, 8, 8);

    const coordinator = new PokemonBattleEvolutionHudSyncCoordinator({
      presentRequiredEvolution: async () =>
        createEvolutionResolved("pokemon-bench", 7, 7, 8, 8),

      getTrainerState: () => trainerState,

      syncTrainerPokemonAfterEvolution: (evolvedPokemon, trainerParty) => {
        battleSnapshot = syncAuthoritativeTrainerPokemonIntoBattleSnapshot(
          battleSnapshot,
          evolvedPokemon.pokemon,
        );

        partyProjection = trainerParty;

        const trainer = battleSnapshot.participants.find(
          (participant) => participant.type === "trainer",
        );

        if (!trainer) {
          throw new Error("Trainer participant missing");
        }

        const activePokemon = trainer.pokemon[trainer.activePokemonIndex];

        /*
         * Mirrors the BattleOverlay
         * instanceId guard:
         *
         * a benched Evolution must not
         * replace the active HUD.
         */
        if (
          activePokemon &&
          activePokemon.pokemon.instanceId === evolvedPokemon.pokemon.instanceId
        ) {
          activeHudProjection = activePokemon;
        }

        order.push("sync");
      },

      finishEvolutionCinematic: () => {
        order.push("cinematic-finish");
      },
    });

    await coordinator.presentRequiredEvolution(request);

    const trainer = battleSnapshot.participants.find(
      (participant) => participant.type === "trainer",
    );

    expect(trainer).toBeDefined();

    /*
     * Active slot remains exactly 0.
     */
    expect(trainer?.activePokemonIndex).toBe(0);

    /*
     * Active Pokémon stays Charmander.
     */
    expect(trainer?.pokemon[0]?.pokemon.instanceId).toBe("pokemon-active");

    expect(trainer?.pokemon[0]?.pokemon.speciesId).toBe(4);

    /*
     * Bench Pokémon has evolved.
     */
    expect(trainer?.pokemon[1]?.pokemon).toBe(benchPokemonAfterEvolution);

    expect(trainer?.pokemon[1]?.pokemon.speciesId).toBe(8);

    expect(trainer?.pokemon[1]?.pokemon.formId).toBe(8);

    /*
     * Its Battle runtime HP remains 23,
     * rather than being overwritten with
     * TrainerState currentHp = 45.
     */
    expect(trainer?.pokemon[1]?.currentHp).toBe(23);

    /*
     * Active HUD was NOT replaced by
     * the benched evolved Pokémon.
     */
    expect(activeHudProjection.pokemon.instanceId).toBe("pokemon-active");

    expect(activeHudProjection.pokemon.speciesId).toBe(4);

    /*
     * Party projection does receive
     * the evolved authoritative instance.
     */
    expect(partyProjection[1]?.pokemon).toBe(benchPokemonAfterEvolution);

    expect(partyProjection[1]?.pokemon.speciesId).toBe(8);

    expect(order).toEqual(["sync", "cinematic-finish"]);
  });
});
