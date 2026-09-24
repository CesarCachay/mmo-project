import { describe, expect, it } from "vitest";

import {
  createBattlePokemonState,
  createPokemonInstance,
  createPersistentMajorStatusFromBattle,
  ensureBattlePokemonStatusState,
  syncPokemonPartyFromBattleParticipant,
  createBattleParticipant,
} from "../src/index.js";

describe("Pokémon major status persistence bridge", () => {
  it("hydrates a persisted Sleep status into battle runtime state", () => {
    const pokemon = createPokemonInstance(25, 30);
    pokemon.majorStatus = {
      type: "sleep",
      turnsRemaining: 3,
    };

    const battlePokemon = createBattlePokemonState(pokemon);

    expect(battlePokemon.statusState).toEqual({
      major: {
        type: "sleep",
        turnsRemaining: 3,
      },
      confusion: null,
    });
  });

  it("hydrates persisted Bad Poison with a fresh toxic counter", () => {
    const pokemon = createPokemonInstance(1, 30);
    pokemon.majorStatus = { type: "badly-poisoned" };

    const battlePokemon = createBattlePokemonState(pokemon);

    expect(battlePokemon.statusState?.major).toEqual({
      type: "badly-poisoned",
      toxicCounter: 1,
    });
  });

  it("serializes battle major status but never serializes confusion", () => {
    const battlePokemon = createBattlePokemonState(createPokemonInstance(4, 30));
    battlePokemon.statusState = {
      major: {
        type: "badly-poisoned",
        toxicCounter: 8,
      },
      confusion: {
        turnsRemaining: 3,
      },
    };

    expect(
      createPersistentMajorStatusFromBattle(
        ensureBattlePokemonStatusState(battlePokemon).major,
      ),
    ).toEqual({ type: "badly-poisoned" });
  });

  it("syncs the final battle major status back to the Trainer party", () => {
    const originalPokemon = createPokemonInstance(7, 30);
    const battlePokemon = createBattlePokemonState(originalPokemon);
    battlePokemon.statusState = {
      major: {
        type: "sleep",
        turnsRemaining: 2,
      },
      confusion: {
        turnsRemaining: 4,
      },
    };

    const participant = createBattleParticipant({
      id: "trainer",
      type: "trainer",
      side: "side-a",
      pokemon: [battlePokemon],
    });

    const synced = syncPokemonPartyFromBattleParticipant(
      { pokemon: [originalPokemon] },
      participant,
    );

    expect(synced.pokemon[0]?.majorStatus).toEqual({
      type: "sleep",
      turnsRemaining: 2,
    });
    expect("confusion" in (synced.pokemon[0] ?? {})).toBe(false);
  });
});
