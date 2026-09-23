export const NPC_FRAME_WIDTH = 24;
export const NPC_FRAME_HEIGHT = 24;
export const NPC_FRAME_COUNT = 12;

export type NpcDirection = "up" | "down" | "left" | "right";

type NpcAssetDefinition = {
  folder: string;
  directions: readonly NpcDirection[];
};

export const NPC_ASSETS = {
  "professor-oak": {
    folder: "/assets/characters/npcs/professor-oak",
    directions: ["down", "up", "left", "right"],
  },
  "dra-gianela": {
    folder: "/assets/characters/npcs/dra-gianela",
    directions: ["down", "up", "left", "right"],
  },
  "student-gary": {
    folder: "/assets/characters/npcs/student-gary",
    directions: ["down", "up", "left", "right"],
  },
  "student-francisca": {
    folder: "/assets/characters/npcs/student-francisca",
    directions: ["down", "up", "left", "right"],
  },
  "manager-cesar": {
    folder: "/assets/characters/npcs/manager-cesar",
    directions: ["down", "up", "left", "right"],
  },
  "gym-leader-brock": {
    folder: "/assets/characters/leaders/brock",
    directions: ["down"],
  },
  "gym-leader-misty": {
    folder: "/assets/characters/leaders/misty",
    directions: ["down"],
  },
  "gym-leader-surge": {
    folder: "/assets/characters/leaders/surge",
    directions: ["down"],
  },
  "gym-leader-erika": {
    folder: "/assets/characters/leaders/erika",
    directions: ["down"],
  },
  "gym-leader-koga": {
    folder: "/assets/characters/leaders/koga",
    directions: ["down"],
  },
  "gym-leader-sabrina": {
    folder: "/assets/characters/leaders/sabrina",
    directions: ["down"],
  },
  "gym-leader-giovanni": {
    folder: "/assets/characters/leaders/giovanni",
    directions: ["down"],
  },
} satisfies Record<string, NpcAssetDefinition>;

export const getNpcTextureKey = (sprite: string, direction: NpcDirection): string => {
  return `npc-${sprite}-walk-${direction}`;
};

/**
 * Returns texture keys in render preference order without changing the NPC's
 * logical direction. This lets Trainer Sight keep using the map direction even
 * when an appearance only has a subset of directional sprite assets.
 */
export const getNpcTextureKeyCandidates = (
  sprite: string,
  direction: NpcDirection
): readonly string[] => {
  const definition = NPC_ASSETS[sprite as keyof typeof NPC_ASSETS];
  const fallbackDirections = definition?.directions ?? [];
  const directions = [
    direction,
    ...fallbackDirections.filter((candidate) => candidate !== direction),
  ];

  return directions.map((candidate) => getNpcTextureKey(sprite, candidate));
};
