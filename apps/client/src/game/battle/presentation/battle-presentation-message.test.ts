import { describe, expect, it } from "vitest";

import {
  createBattleParticipant,
  createBattlePokemonState,
  createPokemonInstance,
  type BattleInstance,
  type BattlePokemonSwitchedEvent,
} from "@cesar-mmo/shared";

import { formatBattlePresentationMessage } from "./battle-presentation-message";

function createTrainerBattle(): BattleInstance {
  const playerPokemon = createBattlePokemonState(createPokemonInstance(1, 10));
  const rattata = createBattlePokemonState(createPokemonInstance(19, 7));
  const pidgey = createBattlePokemonState(createPokemonInstance(16, 9));

  const localParticipant = createBattleParticipant({
    id: "local-trainer",
    type: "trainer",
    side: "side-a",
    pokemon: [playerPokemon],
  });

  const opponentParticipant = createBattleParticipant({
    id: "npc-trainer",
    type: "trainer",
    side: "side-b",
    displayName: "Gary",
    pokemon: [rattata, pidgey],
    activePokemonIndex: 0,
  });

  return {
    battleId: "battle-trainer-message",
    type: "trainer",
    status: "active",
    participants: [localParticipant, opponentParticipant],
  };
}

describe("formatBattlePresentationMessage Trainer Battle switch messages", () => {
  it("uses the opponent Trainer display name for an NPC replacement", () => {
    const battle = createTrainerBattle();
    const opponent = battle.participants[1]!;
    const event: BattlePokemonSwitchedEvent = {
      type: "pokemon-switched",
      participantId: opponent.id,
      previousActivePokemonIndex: 0,
      currentActivePokemonIndex: 1,
      previousPokemonInstanceId: opponent.pokemon[0]!.pokemon.instanceId,
      currentPokemonInstanceId: opponent.pokemon[1]!.pokemon.instanceId,
    };

    expect(
      formatBattlePresentationMessage(battle, event, "local-trainer"),
    ).toBe("Gary sent out Pidgey!");
  });

  it("keeps the local Trainer switch message as Go!", () => {
    const battle = createTrainerBattle();
    const local = battle.participants[0]!;
    const secondPokemon = createBattlePokemonState(
      createPokemonInstance(7, 10),
    );

    const battleWithTwoLocalPokemon: BattleInstance = {
      ...battle,
      participants: [
        {
          ...local,
          pokemon: [...local.pokemon, secondPokemon],
        },
        battle.participants[1]!,
      ],
    };

    const event: BattlePokemonSwitchedEvent = {
      type: "pokemon-switched",
      participantId: local.id,
      previousActivePokemonIndex: 0,
      currentActivePokemonIndex: 1,
      previousPokemonInstanceId: local.pokemon[0]!.pokemon.instanceId,
      currentPokemonInstanceId: secondPokemon.pokemon.instanceId,
    };

    expect(
      formatBattlePresentationMessage(
        battleWithTwoLocalPokemon,
        event,
        "local-trainer",
      ),
    ).toBe("Go! Squirtle!");
  });

  it("falls back to a generic opponent Trainer label when no display name exists", () => {
    const battle = createTrainerBattle();
    const opponent = battle.participants[1]!;
    const battleWithoutName: BattleInstance = {
      ...battle,
      participants: [
        battle.participants[0]!,
        { ...opponent, displayName: undefined },
      ],
    };

    const event: BattlePokemonSwitchedEvent = {
      type: "pokemon-switched",
      participantId: opponent.id,
      previousActivePokemonIndex: 0,
      currentActivePokemonIndex: 1,
      previousPokemonInstanceId: opponent.pokemon[0]!.pokemon.instanceId,
      currentPokemonInstanceId: opponent.pokemon[1]!.pokemon.instanceId,
    };

    expect(
      formatBattlePresentationMessage(
        battleWithoutName,
        event,
        "local-trainer",
      ),
    ).toBe("The opposing Trainer sent out Pidgey!");
  });
});
