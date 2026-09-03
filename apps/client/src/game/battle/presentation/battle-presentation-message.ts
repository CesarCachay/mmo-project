import {
  getPokemonItem,
  getPokemonMove,
  type BattleInstance,
  type BattlePresentationEvent,
} from "@cesar-mmo/shared";

import { getPokemonDisplayName } from "../../pokemon/pokemon-presentation.utils";

export function formatBattlePresentationMessage(
  battle: BattleInstance,
  event: BattlePresentationEvent
): string | null {
  switch (event.type) {
    case "move-used": {
      const pokemonName = getBattlePokemonDisplayName(
        battle,
        event.participantId,
        event.pokemonInstanceId
      );

      const move = getPokemonMove(event.moveId);
      const moveName = move ? formatMoveName(move.name) : `Move ${event.moveId}`;
      return `${pokemonName} used ${moveName}!`;
    }

    case "move-missed": {
      return "But it missed!";
    }

    case "damage-applied": {
      if (event.typeEffectiveness === 0) {
        return "It had no effect!";
      }

      if (event.typeEffectiveness > 1) {
        return "It's super effective!";
      }

      if (event.typeEffectiveness > 0 && event.typeEffectiveness < 1) {
        return "It's not very effective...";
      }

      return null;
    }

    case "pokemon-fainted": {
      const pokemonName = getBattlePokemonDisplayName(
        battle,
        event.participantId,
        event.pokemonInstanceId
      );

      return `${pokemonName} fainted!`;
    }

    case "pokemon-switched": {
      const pokemonName = getBattlePokemonDisplayName(
        battle,
        event.participantId,
        event.currentPokemonInstanceId
      );

      const participant = battle.participants.find(
        (candidate) => candidate.id === event.participantId
      );

      if (participant?.type === "trainer") {
        return `Go! ${pokemonName}!`;
      }

      return `${pokemonName} entered the battle!`;
    }

    case "run-failed": {
      return "Couldn't get away!";
    }

    case "run-succeeded": {
      return "Got away safely!";
    }

    case "item-used": {
      const item = getPokemonItem(event.itemId);
      return `Used a ${item.name}!`;
    }

    case "hp-restored": {
      return null;
    }

    case "capture-failed": {
      return "Oh no! The Pokémon broke free!";
    }

    case "capture-succeeded": {
      const pokemonName = getBattlePokemonDisplayName(
        battle,
        event.wildParticipantId,
        event.pokemonInstanceId
      );

      return `Gotcha! ${pokemonName} was caught!`;
    }
  }
}

function getBattlePokemonDisplayName(
  battle: BattleInstance,
  participantId: string,
  pokemonInstanceId: string
): string {
  const participant = battle.participants.find(
    (candidate) => candidate.id === participantId
  );

  const pokemonState = participant?.pokemon.find(
    (candidate) => candidate.pokemon.instanceId === pokemonInstanceId
  );

  if (!pokemonState) {
    console.warn("[BattlePresentationMessage] Pokémon not found", {
      battleId: battle.battleId,
      participantId,
      pokemonInstanceId,
    });

    return "Pokémon";
  }

  return getPokemonDisplayName(pokemonState.pokemon);
}

function formatMoveName(name: string): string {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
