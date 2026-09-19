import type { PokemonTrainerBattleDefinition } from "./pokemon-trainer-battle.types.js";

export const POKEMON_TRAINER_BATTLE_REGISTRY = {
  "student-gary": {
    id: "student-gary",
    displayName: "Gary",
    trainerClass: "Student",
    appearanceId: "student-gary",
    aiProfileId: "basic",
    preBattleDialogueId: "trainer-student-gary-pre-battle",
    party: [
      {
        speciesId: 19, // Rattata
        level: 7,
        moveIds: [33, 98], // Tackle, Quick Attack
      },
      {
        speciesId: 16, // Pidgey
        level: 9,
        moveIds: [33, 16], // Tackle, Gust
      },
    ],
  },

  "student-francisca": {
    id: "student-francisca",
    displayName: "Francisca",
    trainerClass: "Student",
    appearanceId: "student-francisca",
    aiProfileId: "basic",
    preBattleDialogueId: "trainer-student-francisca-pre-battle",
    party: [
      {
        speciesId: 29, // Nidoran♀
        level: 9,
        moveIds: [10, 24], // Scratch, Double Kick
      },
      {
        speciesId: 32, // Nidoran♂
        level: 9,
        moveIds: [64, 24], // Peck, Double Kick
      },
    ],
  },
} as const satisfies Record<string, PokemonTrainerBattleDefinition>;

export type PokemonTrainerBattleId =
  keyof typeof POKEMON_TRAINER_BATTLE_REGISTRY;

export function isPokemonTrainerBattleId(
  value: unknown,
): value is PokemonTrainerBattleId {
  return (
    typeof value === "string" && value in POKEMON_TRAINER_BATTLE_REGISTRY
  );
}

export function getPokemonTrainerBattleDefinition(
  trainerBattleId: PokemonTrainerBattleId,
): PokemonTrainerBattleDefinition {
  return POKEMON_TRAINER_BATTLE_REGISTRY[trainerBattleId];
}

export function findPokemonTrainerBattleDefinition(
  trainerBattleId: string,
): PokemonTrainerBattleDefinition | undefined {
  if (!isPokemonTrainerBattleId(trainerBattleId)) {
    return undefined;
  }

  return getPokemonTrainerBattleDefinition(trainerBattleId);
}

export function getAllPokemonTrainerBattleDefinitions(): readonly PokemonTrainerBattleDefinition[] {
  return Object.values(POKEMON_TRAINER_BATTLE_REGISTRY);
}
