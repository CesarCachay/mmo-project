import { describe, expect, it } from "vitest";

import {
  addPokemonToParty,
  applyBattleEndTurnStatusEffects,
  clearBattlePokemonConfusion,
  createBattleParticipant,
  createBattlePokemonState,
  createPokemonInstance,
  createPokemonParty,
  createPersistentMajorStatusFromBattle,
  ensureBattlePokemonStatusState,
  planBattleTrainerMedicineItemUse,
  resetBattlePokemonBadPoisonCounter,
  syncPokemonPartyFromBattleParticipant,
  type BattleInstance,
  type PokemonInventory,
} from "../src/index.js";

function createTrainerBattle() {
  const trainerPokemon = createPokemonInstance(25, 30);
  const opponentPokemon = createPokemonInstance(1, 30);
  const party = addPokemonToParty(createPokemonParty(), trainerPokemon);

  const trainerParticipant = createBattleParticipant({
    id: "local-trainer",
    type: "trainer",
    side: "side-a",
    pokemon: [createBattlePokemonState(trainerPokemon)],
    activePokemonIndex: 0,
  });

  const opponentParticipant = createBattleParticipant({
    id: "opponent-trainer",
    type: "trainer",
    side: "side-b",
    pokemon: [createBattlePokemonState(opponentPokemon)],
    activePokemonIndex: 0,
  });

  const battle: BattleInstance = {
    battleId: "status-v1-integration",
    type: "trainer",
    status: "active",
    participants: [trainerParticipant, opponentParticipant],
  };

  return { battle, party, trainerParticipant };
}

describe("Status Conditions V1 integration", () => {
  it("persists major status from Battle but never persists Confusion", () => {
    const { party, trainerParticipant } = createTrainerBattle();
    const active = trainerParticipant.pokemon[0]!;
    const status = ensureBattlePokemonStatusState(active);

    status.major = { type: "sleep", turnsRemaining: 2 };
    status.confusion = { turnsRemaining: 4 };

    const synced = syncPokemonPartyFromBattleParticipant(
      party,
      trainerParticipant,
    );

    expect(synced.pokemon[0]!.majorStatus).toEqual({
      type: "sleep",
      turnsRemaining: 2,
    });
    expect("confusion" in synced.pokemon[0]!).toBe(false);
  });

  it("keeps Bad Poison durable while resetting its runtime counter on exit/switch", () => {
    const { trainerParticipant } = createTrainerBattle();
    const active = trainerParticipant.pokemon[0]!;
    const status = ensureBattlePokemonStatusState(active);

    status.major = { type: "badly-poisoned", toxicCounter: 6 };

    expect(createPersistentMajorStatusFromBattle(status.major)).toEqual({
      type: "badly-poisoned",
    });

    expect(resetBattlePokemonBadPoisonCounter(active)).toBe(true);
    expect(status.major).toEqual({
      type: "badly-poisoned",
      toxicCounter: 1,
    });
  });

  it("clears Confusion on switch without clearing the major status", () => {
    const { trainerParticipant } = createTrainerBattle();
    const active = trainerParticipant.pokemon[0]!;
    const status = ensureBattlePokemonStatusState(active);

    status.major = { type: "burn" };
    status.confusion = { turnsRemaining: 3 };

    expect(clearBattlePokemonConfusion(active)).toBe(true);
    expect(status.confusion).toBeNull();
    expect(status.major).toEqual({ type: "burn" });
  });

  it("applies residual status damage only to active eligible Pokémon", () => {
    const { battle, trainerParticipant } = createTrainerBattle();
    const active = trainerParticipant.pokemon[0]!;
    const previousHp = active.currentHp;

    ensureBattlePokemonStatusState(active).major = { type: "poison" };

    const effects = applyBattleEndTurnStatusEffects(battle);
    const trainerEffect = effects.find(
      (effect) => effect.participantId === trainerParticipant.id,
    );

    expect(trainerEffect).toMatchObject({
      type: "status-residual-damage",
      participantId: trainerParticipant.id,
      pokemonInstanceId: active.pokemon.instanceId,
      status: "poison",
      previousHp,
    });
    expect(active.currentHp).toBeLessThan(previousHp);
  });

  it("plans Full Heal to clear a major status and Confusion in one Battle use", () => {
    const { battle, trainerParticipant } = createTrainerBattle();
    const active = trainerParticipant.pokemon[0]!;
    const status = ensureBattlePokemonStatusState(active);

    status.major = { type: "paralysis" };
    status.confusion = { turnsRemaining: 2 };

    const inventory: PokemonInventory = {
      items: [{ itemId: "full-heal", quantity: 1 }],
    };

    expect(
      planBattleTrainerMedicineItemUse(
        battle,
        trainerParticipant.id,
        {
          type: "use-item",
          itemId: "full-heal",
          target: {
            type: "trainer-pokemon",
            pokemonInstanceId: active.pokemon.instanceId,
          },
        },
        inventory,
      ),
    ).toEqual({
      kind: "status-cure",
      participantId: trainerParticipant.id,
      itemId: "full-heal",
      targetPokemonInstanceId: active.pokemon.instanceId,
      curedMajorStatus: "paralysis",
      curedConfusion: true,
    });
  });
});
