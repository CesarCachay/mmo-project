import type { PokemonTrainerBattleDefinition } from "./pokemon-trainer-battle.types.js";

export const POKEMON_TRAINER_BATTLE_REGISTRY = {
  "student-gary": {
    id: "student-gary",
    displayName: "Gary",
    trainerClass: "Student",
    appearanceId: "student-gary",
    category: "standard",
    aiProfileId: "basic",
    preBattleDialogueId: "trainer-student-gary-pre-battle",
    postBattleDialogueId: "trainer-student-gary-post-battle",
    rewardItems: [{ itemId: "potion", quantity: 1 }],
    rewardMoney: 350,
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
    category: "standard",
    aiProfileId: "basic",
    preBattleDialogueId: "trainer-student-francisca-pre-battle",
    postBattleDialogueId: "trainer-student-francisca-post-battle",
    rewardItems: [{ itemId: "super-potion", quantity: 1 }],
    rewardMoney: 500,
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

  "youngster-diego": {
    id: "youngster-diego",
    displayName: "Diego",
    trainerClass: "Youngster",
    appearanceId: "student-gary",
    category: "standard",
    aiProfileId: "basic",
    preBattleDialogueId: "trainer-youngster-diego-pre-battle",
    postBattleDialogueId: "trainer-youngster-diego-post-battle",
    rewardItems: [{ itemId: "poke-ball", quantity: 2 }],
    rewardMoney: 650,
    party: [
      {
        speciesId: 21, // Spearow
        level: 12,
        moveIds: [64, 31], // Peck, Fury Attack
      },
      {
        speciesId: 27, // Sandshrew
        level: 13,
        moveIds: [10, 229], // Scratch, Rapid Spin
      },
      {
        speciesId: 19, // Rattata
        level: 14,
        moveIds: [98, 44], // Quick Attack, Bite
      },
    ],
  },

  "picnicker-valeria": {
    id: "picnicker-valeria",
    displayName: "Valeria",
    trainerClass: "Picnicker",
    appearanceId: "student-francisca",
    category: "standard",
    aiProfileId: "basic",
    preBattleDialogueId: "trainer-picnicker-valeria-pre-battle",
    postBattleDialogueId: "trainer-picnicker-valeria-post-battle",
    rewardItems: [{ itemId: "potion", quantity: 2 }],
    rewardMoney: 800,
    party: [
      {
        speciesId: 46, // Paras
        level: 13,
        moveIds: [10, 141], // Scratch, Leech Life
      },
      {
        speciesId: 43, // Oddish
        level: 14,
        moveIds: [71, 51], // Absorb, Acid
      },
      {
        speciesId: 12, // Butterfree
        level: 16,
        moveIds: [93, 16], // Confusion, Gust
      },
    ],
  },

  "hiker-marcos": {
    id: "hiker-marcos",
    displayName: "Marcos",
    trainerClass: "Hiker",
    appearanceId: "student-gary",
    category: "standard",
    aiProfileId: "basic",
    preBattleDialogueId: "trainer-hiker-marcos-pre-battle",
    postBattleDialogueId: "trainer-hiker-marcos-post-battle",
    rewardItems: [{ itemId: "super-potion", quantity: 1 }],
    rewardMoney: 950,
    party: [
      {
        speciesId: 66, // Machop
        level: 14,
        moveIds: [67, 2], // Low Kick, Karate Chop
      },
      {
        speciesId: 74, // Geodude
        level: 15,
        moveIds: [33, 88], // Tackle, Rock Throw
      },
      {
        speciesId: 95, // Onix
        level: 16,
        moveIds: [20, 88], // Bind, Rock Throw
      },
    ],
  },

  "ace-trainer-lucia": {
    id: "ace-trainer-lucia",
    displayName: "Lucia",
    trainerClass: "Ace Trainer",
    appearanceId: "student-francisca",
    category: "standard",
    aiProfileId: "basic",
    preBattleDialogueId: "trainer-ace-trainer-lucia-pre-battle",
    postBattleDialogueId: "trainer-ace-trainer-lucia-post-battle",
    rewardItems: [{ itemId: "revive", quantity: 1 }],
    rewardMoney: 1200,
    party: [
      {
        speciesId: 25, // Pikachu
        level: 15,
        moveIds: [84, 98], // Thunder Shock, Quick Attack
      },
      {
        speciesId: 96, // Drowzee
        level: 16,
        moveIds: [1, 93], // Pound, Confusion
      },
      {
        speciesId: 17, // Pidgeotto
        level: 18,
        moveIds: [16, 98], // Gust, Quick Attack
      },
    ],
  },

  "gym-leader-brock": {
    id: "gym-leader-brock",
    displayName: "Brock",
    trainerClass: "Gym Leader",
    appearanceId: "gym-leader-brock",
    category: "gym-leader",
    gymLeader: {
      gymId: "gym-01",
      badgeId: "boulder-badge",
      leaderPresentationId: "brock",
    },
    aiProfileId: "basic",
    preBattleDialogueId: "gym-leader-brock-pre-battle",
    postBattleDialogueId: "gym-leader-brock-post-battle",
    rewardItems: [{ itemId: "super-potion", quantity: 2 }],
    rewardMoney: 1800,
    party: [
      {
        speciesId: 74, // Geodude
        level: 18,
        moveIds: [33, 88], // Tackle, Rock Throw
      },
      {
        speciesId: 95, // Onix
        level: 20,
        moveIds: [20, 88], // Bind, Rock Throw
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
