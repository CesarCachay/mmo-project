import type Phaser from "phaser";
import type { PokemonTrainerBattleId } from "@cesar-mmo/shared";

export type NpcInteractionType =
  | "dialogue"
  | "shop"
  | "quest"
  | "trainer-battle";

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
  trainerBattleId?: PokemonTrainerBattleId;
  sightRangeTiles?: number;
  postDialogueAction?: NpcPostDialogueAction;
};

export type NpcInstance = {
  definition: NpcDefinition;
  sprite: Phaser.GameObjects.Sprite;
  nameLabel: Phaser.GameObjects.Text;
};

export type NpcPostDialogueAction = "chooseStarter";
