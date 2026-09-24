import { describe, expect, it } from "vitest";

import { getPokemonMove } from "../../pokemon-move.registry.js";
import { calculatePokemonMaxHp } from "../../pokemon-stat.js";
import type {
  PokemonInstance,
  PokemonParty,
} from "../../pokemon.types.js";
import { planPokemonCenterHealing } from "../pokemon-center-healing.js";

function createCharmander(
  overrides: Partial<PokemonInstance> = {},
): PokemonInstance {
  return {
    instanceId: "charmander-instance",
    speciesId: 4,
    formId: 4,
    nickname: "Cinder",
    level: 10,
    experience: 1000,
    currentHp: 1,
    abilityId: 66,
    moves: [
      {
        moveId: 10,
        currentPp: 4,
      },
      {
        moveId: 52,
        currentPp: 0,
      },
    ],
    ...overrides,
  };
}

function createSquirtle(
  overrides: Partial<PokemonInstance> = {},
): PokemonInstance {
  return {
    instanceId: "squirtle-instance",
    speciesId: 7,
    formId: 7,
    level: 12,
    experience: 1200,
    currentHp: 0,
    abilityId: 67,
    moves: [
      {
        moveId: 33,
        currentPp: 2,
      },
      {
        moveId: 55,
        currentPp: 1,
      },
    ],
    ...overrides,
  };
}

function getMaxPp(moveId: number): number {
  const move = getPokemonMove(moveId);

  if (!move) {
    throw new Error(`Expected test move ${moveId} to exist`);
  }

  return move.pp ?? 0;
}

describe("planPokemonCenterHealing", () => {
  it("fully restores HP and PP for every Pokémon in the active party", () => {
    const charmander = createCharmander();
    const squirtle = createSquirtle();

    const party: PokemonParty = {
      pokemon: [charmander, squirtle],
    };

    const result = planPokemonCenterHealing(party);

    expect(result.updatedParty.pokemon).toEqual([
      {
        ...charmander,
        currentHp: calculatePokemonMaxHp(charmander),
        moves: charmander.moves.map((move) => ({
          ...move,
          currentPp: getMaxPp(move.moveId),
        })),
      },
      {
        ...squirtle,
        currentHp: calculatePokemonMaxHp(squirtle),
        moves: squirtle.moves.map((move) => ({
          ...move,
          currentPp: getMaxPp(move.moveId),
        })),
      },
    ]);

    expect(result.restoredPokemonCount).toBe(2);
    expect(result.totalHpRestored).toBe(
      calculatePokemonMaxHp(charmander) - charmander.currentHp +
        calculatePokemonMaxHp(squirtle) - squirtle.currentHp,
    );
    expect(result.totalPpRestored).toBe(
      charmander.moves.reduce(
        (total, move) => total + getMaxPp(move.moveId) - move.currentPp,
        0,
      ) +
        squirtle.moves.reduce(
          (total, move) => total + getMaxPp(move.moveId) - move.currentPp,
          0,
        ),
    );
  });

  it("restores a fainted Pokémon to full HP", () => {
    const faintedPokemon = createSquirtle({
      currentHp: 0,
      moves: [],
    });

    const result = planPokemonCenterHealing({
      pokemon: [faintedPokemon],
    });

    expect(result.updatedParty.pokemon[0]?.currentHp).toBe(
      calculatePokemonMaxHp(faintedPokemon),
    );
    expect(result.restoredPokemonCount).toBe(1);
    expect(result.totalHpRestored).toBe(
      calculatePokemonMaxHp(faintedPokemon),
    );
  });

  it("clears a major status even when HP and PP are already full", () => {
    const base = createCharmander({
      moves: [
        { moveId: 10, currentPp: getMaxPp(10) },
        { moveId: 52, currentPp: getMaxPp(52) },
      ],
      majorStatus: { type: "burn" },
    });
    const pokemon = {
      ...base,
      currentHp: calculatePokemonMaxHp(base),
    };

    const result = planPokemonCenterHealing({ pokemon: [pokemon] });

    expect(result.updatedParty.pokemon[0]?.majorStatus).toBeNull();
    expect(result.restoredPokemonCount).toBe(1);
    expect(result.totalHpRestored).toBe(0);
    expect(result.totalPpRestored).toBe(0);
  });

  it("leaves an already healthy party functionally unchanged", () => {
    const pokemon = createCharmander({
      currentHp: calculatePokemonMaxHp(createCharmander()),
      moves: [
        {
          moveId: 10,
          currentPp: getMaxPp(10),
        },
        {
          moveId: 52,
          currentPp: getMaxPp(52),
        },
      ],
    });

    const result = planPokemonCenterHealing({
      pokemon: [pokemon],
    });

    expect(result.updatedParty).toEqual({
      pokemon: [pokemon],
    });
    expect(result.restoredPokemonCount).toBe(0);
    expect(result.totalHpRestored).toBe(0);
    expect(result.totalPpRestored).toBe(0);
  });

  it("preserves Pokémon identity, progression, party order, and known moves", () => {
    const first = createCharmander();
    const second = createSquirtle();

    const result = planPokemonCenterHealing({
      pokemon: [first, second],
    });

    expect(
      result.updatedParty.pokemon.map((pokemon) => ({
        instanceId: pokemon.instanceId,
        speciesId: pokemon.speciesId,
        formId: pokemon.formId,
        nickname: pokemon.nickname,
        level: pokemon.level,
        experience: pokemon.experience,
        abilityId: pokemon.abilityId,
        moveIds: pokemon.moves.map((move) => move.moveId),
      })),
    ).toEqual(
      [first, second].map((pokemon) => ({
        instanceId: pokemon.instanceId,
        speciesId: pokemon.speciesId,
        formId: pokemon.formId,
        nickname: pokemon.nickname,
        level: pokemon.level,
        experience: pokemon.experience,
        abilityId: pokemon.abilityId,
        moveIds: pokemon.moves.map((move) => move.moveId),
      })),
    );
  });

  it("does not mutate the original party while planning healing", () => {
    const party: PokemonParty = {
      pokemon: [createCharmander(), createSquirtle()],
    };

    const snapshot = structuredClone(party);

    const result = planPokemonCenterHealing(party);

    expect(party).toEqual(snapshot);
    expect(result.updatedParty).not.toBe(party);
    expect(result.updatedParty.pokemon).not.toBe(party.pokemon);
    expect(result.updatedParty.pokemon[0]).not.toBe(party.pokemon[0]);
    expect(result.updatedParty.pokemon[0]?.moves).not.toBe(
      party.pokemon[0]?.moves,
    );
  });

  it("supports an empty party without producing healing side effects", () => {
    const result = planPokemonCenterHealing({
      pokemon: [],
    });

    expect(result).toEqual({
      updatedParty: {
        pokemon: [],
      },
      restoredPokemonCount: 0,
      totalHpRestored: 0,
      totalPpRestored: 0,
    });
  });

  it("rejects an unknown move instead of returning a partially healed party", () => {
    const pokemon = createCharmander({
      moves: [
        {
          moveId: 999999,
          currentPp: 0,
        },
      ],
    });

    expect(() =>
      planPokemonCenterHealing({
        pokemon: [pokemon],
      }),
    ).toThrow(
      'Pokémon move "999999" not found while planning Pokémon Center healing',
    );
  });
});
