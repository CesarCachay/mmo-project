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
    directions: ["down"],
  },
  "student-francisca": {
    folder: "/assets/characters/npcs/student-francisca",
    directions: ["down"],
  },
} satisfies Record<string, NpcAssetDefinition>;

export const getNpcTextureKey = (sprite: string, direction: NpcDirection): string => {
  return `npc-${sprite}-walk-${direction}`;
};
