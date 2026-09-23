import { getDialogue } from "../../dialogue.js";
import { MAX_POKEMON_MOVE_SLOTS, MAX_POKEMON_PARTY_SIZE } from "../pokemon.types.js";
import { getPokemonMove } from "../pokemon-move.registry.js";
import { isPokemonItemId } from "../inventory/pokemon-inventory.js";
import { getPokemonSpecies } from "../pokemon.registry.js";
import { MAX_POKEMON_LEVEL } from "../progression/pokemon-experience.js";
import { POKEMON_MAX_MONEY } from "../economy/pokemon-money.js";
import type { PokemonTrainerBattleDefinition } from "./pokemon-trainer-battle.types.js";

export interface PokemonTrainerBattleValidationIssue {
  readonly trainerBattleId: string;
  readonly path: string;
  readonly message: string;
}

function createIssue(
  definition: PokemonTrainerBattleDefinition,
  path: string,
  message: string,
): PokemonTrainerBattleValidationIssue {
  return {
    trainerBattleId: definition.id,
    path,
    message,
  };
}

export function validatePokemonTrainerBattleDefinition(
  definition: PokemonTrainerBattleDefinition,
): readonly PokemonTrainerBattleValidationIssue[] {
  const issues: PokemonTrainerBattleValidationIssue[] = [];

  if (definition.id.trim().length === 0) {
    issues.push(createIssue(definition, "id", "Trainer battle id is required"));
  }

  if (definition.displayName.trim().length === 0) {
    issues.push(
      createIssue(definition, "displayName", "Trainer display name is required"),
    );
  }

  if (definition.trainerClass.trim().length === 0) {
    issues.push(
      createIssue(definition, "trainerClass", "Trainer class is required"),
    );
  }

  if (definition.appearanceId.trim().length === 0) {
    issues.push(
      createIssue(definition, "appearanceId", "Trainer appearance id is required"),
    );
  }

  if (definition.category === "gym-leader") {
    if (!definition.gymLeader) {
      issues.push(
        createIssue(
          definition,
          "gymLeader",
          "Gym Leader battles require gym metadata",
        ),
      );
    } else {
      if (definition.gymLeader.gymId.trim().length === 0) {
        issues.push(createIssue(definition, "gymLeader.gymId", "Gym id is required"));
      }

      if (definition.gymLeader.badgeId.trim().length === 0) {
        issues.push(
          createIssue(definition, "gymLeader.badgeId", "Gym badge id is required"),
        );
      }

      if (definition.gymLeader.leaderPresentationId.trim().length === 0) {
        issues.push(
          createIssue(
            definition,
            "gymLeader.leaderPresentationId",
            "Gym Leader presentation id is required",
          ),
        );
      }
    }
  } else if (definition.gymLeader) {
    issues.push(
      createIssue(
        definition,
        "gymLeader",
        "Standard Trainer battles cannot define Gym Leader metadata",
      ),
    );
  }

  if (!getDialogue(definition.preBattleDialogueId)) {
    issues.push(
      createIssue(
        definition,
        "preBattleDialogueId",
        `Unknown pre-battle dialogue ${definition.preBattleDialogueId}`,
      ),
    );
  }

  if (!getDialogue(definition.postBattleDialogueId)) {
    issues.push(
      createIssue(
        definition,
        "postBattleDialogueId",
        `Unknown post-battle dialogue ${definition.postBattleDialogueId}`,
      ),
    );
  }

  if (
    !Number.isInteger(definition.rewardMoney) ||
    definition.rewardMoney <= 0 ||
    definition.rewardMoney > POKEMON_MAX_MONEY
  ) {
    issues.push(
      createIssue(
        definition,
        "rewardMoney",
        `Money reward must be a positive integer up to ${POKEMON_MAX_MONEY}`,
      ),
    );
  }

  const rewardItemIds = new Set<string>();

  definition.rewardItems.forEach((rewardItem, rewardIndex) => {
    const pathPrefix = `rewardItems[${rewardIndex}]`;

    if (rewardItemIds.has(rewardItem.itemId)) {
      issues.push(
        createIssue(
          definition,
          `${pathPrefix}.itemId`,
          `Duplicate reward item ${rewardItem.itemId}`,
        ),
      );
    } else {
      rewardItemIds.add(rewardItem.itemId);
    }

    if (!isPokemonItemId(rewardItem.itemId)) {
      issues.push(
        createIssue(
          definition,
          `${pathPrefix}.itemId`,
          `Unknown reward item ${rewardItem.itemId}`,
        ),
      );
    }

    if (!Number.isInteger(rewardItem.quantity) || rewardItem.quantity <= 0) {
      issues.push(
        createIssue(
          definition,
          `${pathPrefix}.quantity`,
          "Reward quantity must be a positive integer",
        ),
      );
    }
  });

  if (
    definition.party.length < 1 ||
    definition.party.length > MAX_POKEMON_PARTY_SIZE
  ) {
    issues.push(
      createIssue(
        definition,
        "party",
        `Trainer party must contain between 1 and ${MAX_POKEMON_PARTY_SIZE} Pokémon`,
      ),
    );
  }

  definition.party.forEach((pokemon, partyIndex) => {
    const pathPrefix = `party[${partyIndex}]`;

    if (!getPokemonSpecies(pokemon.speciesId)) {
      issues.push(
        createIssue(
          definition,
          `${pathPrefix}.speciesId`,
          `Unknown Pokémon species ${pokemon.speciesId}`,
        ),
      );
    }

    if (
      !Number.isInteger(pokemon.level) ||
      pokemon.level < 1 ||
      pokemon.level > MAX_POKEMON_LEVEL
    ) {
      issues.push(
        createIssue(
          definition,
          `${pathPrefix}.level`,
          `Pokémon level must be an integer between 1 and ${MAX_POKEMON_LEVEL}`,
        ),
      );
    }

    if (
      pokemon.moveIds.length < 1 ||
      pokemon.moveIds.length > MAX_POKEMON_MOVE_SLOTS
    ) {
      issues.push(
        createIssue(
          definition,
          `${pathPrefix}.moveIds`,
          `Pokémon must define between 1 and ${MAX_POKEMON_MOVE_SLOTS} moves`,
        ),
      );
    }

    const uniqueMoveIds = new Set<number>();

    pokemon.moveIds.forEach((moveId, moveIndex) => {
      if (uniqueMoveIds.has(moveId)) {
        issues.push(
          createIssue(
            definition,
            `${pathPrefix}.moveIds[${moveIndex}]`,
            `Duplicate move ${moveId}`,
          ),
        );
      } else {
        uniqueMoveIds.add(moveId);
      }

      if (!getPokemonMove(moveId)) {
        issues.push(
          createIssue(
            definition,
            `${pathPrefix}.moveIds[${moveIndex}]`,
            `Unknown Pokémon move ${moveId}`,
          ),
        );
      }
    });
  });

  return issues;
}
