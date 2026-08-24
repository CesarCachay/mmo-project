import type Phaser from "phaser";

export type NpcInteractionType = "dialogue" | "shop" | "quest";

export type NpcDirection = "up" | "down" | "left" | "right";

export type NpcDefinition = {
  id: string;
  x: number;
  y: number;
  displayName: string;
  direction: NpcDirection;
  sprite: string;
  interactionType: NpcInteractionType;
  dialogueId?: string;
};

export type NpcInstance = {
  definition: NpcDefinition;
  sprite: Phaser.GameObjects.Sprite;
  nameLabel: Phaser.GameObjects.Text;
};
