import type { PokemonGymLeaderPresentationId } from "@cesar-mmo/shared";

export interface GymLeaderAssetDefinition {
  readonly folder: string;
  readonly overworldAppearanceId: string;
  readonly introImageUrl: string;
}

export const GYM_LEADER_ASSETS = {
  brock: {
    folder: "/assets/characters/leaders/brock",
    overworldAppearanceId: "gym-leader-brock",
    introImageUrl: "/assets/characters/leaders/brock/leader-intro.png",
  },
  misty: {
    folder: "/assets/characters/leaders/misty",
    overworldAppearanceId: "gym-leader-misty",
    introImageUrl: "/assets/characters/leaders/misty/leader-intro.png",
  },
  surge: {
    folder: "/assets/characters/leaders/surge",
    overworldAppearanceId: "gym-leader-surge",
    introImageUrl: "/assets/characters/leaders/surge/leader-intro.png",
  },
  erika: {
    folder: "/assets/characters/leaders/erika",
    overworldAppearanceId: "gym-leader-erika",
    introImageUrl: "/assets/characters/leaders/erika/leader-intro.png",
  },
  koga: {
    folder: "/assets/characters/leaders/koga",
    overworldAppearanceId: "gym-leader-koga",
    introImageUrl: "/assets/characters/leaders/koga/leader-intro.png",
  },
  sabrina: {
    folder: "/assets/characters/leaders/sabrina",
    overworldAppearanceId: "gym-leader-sabrina",
    introImageUrl: "/assets/characters/leaders/sabrina/leader-intro.png",
  },
  giovanni: {
    folder: "/assets/characters/leaders/giovanni",
    overworldAppearanceId: "gym-leader-giovanni",
    introImageUrl: "/assets/characters/leaders/giovanni/leader-intro.png",
  },
} as const satisfies Record<PokemonGymLeaderPresentationId, GymLeaderAssetDefinition>;

export function getGymLeaderAssetDefinition(
  leaderPresentationId: PokemonGymLeaderPresentationId,
): GymLeaderAssetDefinition {
  return GYM_LEADER_ASSETS[leaderPresentationId];
}
