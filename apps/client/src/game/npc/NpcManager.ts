import Phaser from "phaser";
import { getNpcTextureKey } from "../config/npcAssets";

import type {
  NpcDefinition,
  NpcDirection,
  NpcInstance,
  NpcInteractionType,
} from "./types";

type TiledCustomProperty = {
  name: string;
  value: unknown;
};

type CreateNameLabel = (displayName: string) => Phaser.GameObjects.Text;

export class NpcManager {
  private readonly scene: Phaser.Scene;
  private readonly createNameLabel: CreateNameLabel;
  private readonly npcs = new Map<string, NpcInstance>();

  constructor(scene: Phaser.Scene, createNameLabel: CreateNameLabel) {
    this.scene = scene;
    this.createNameLabel = createNameLabel;
  }

  public create(map: Phaser.Tilemaps.Tilemap): void {
    const npcDefinitions = this.getNpcDefinitions(map);

    for (const npc of npcDefinitions) {
      const textureKey = getNpcTextureKey(npc.sprite, npc.direction);
      if (!this.scene.textures.exists(textureKey)) {
        throw new Error(`NPC texture not found: ${textureKey}`);
      }

      const sprite = this.scene.add.sprite(npc.x, npc.y, textureKey, 0);
      sprite.setDepth(5);
      const nameLabel = this.createNameLabel(npc.displayName);
      nameLabel.setPosition(Math.round(npc.x), Math.round(npc.y - 14));

      this.npcs.set(npc.id, {
        definition: npc,
        sprite,
        nameLabel,
      });
    }
  }

  public destroy(): void {
    for (const npc of this.npcs.values()) {
      npc.sprite.destroy();
      npc.nameLabel.destroy();
    }

    this.npcs.clear();
  }

  public findNearby(
    playerX: number,
    playerY: number,
    interactionDistance: number
  ): NpcInstance | undefined {
    let nearestNpc: NpcInstance | undefined;
    let nearestDistance = interactionDistance;

    for (const npc of this.npcs.values()) {
      const distance = Phaser.Math.Distance.Between(
        playerX,
        playerY,
        npc.sprite.x,
        npc.sprite.y
      );

      if (distance <= nearestDistance) {
        nearestNpc = npc;
        nearestDistance = distance;
      }
    }

    return nearestNpc;
  }

  private getNpcDefinitions(map: Phaser.Tilemaps.Tilemap): NpcDefinition[] {
    const objectsLayer = map.getObjectLayer("Objects");

    if (!objectsLayer) {
      throw new Error('Object layer "Objects" not found');
    }

    return objectsLayer.objects
      .filter((object) => object.type === "npc")
      .map((object) => {
        const properties = (object.properties ?? []) as TiledCustomProperty[];
        const getProperty = (name: string): unknown =>
          properties.find((property) => property.name === name)?.value;

        const displayName = getProperty("displayName");
        const direction = getProperty("direction");
        const sprite = getProperty("sprite");
        const dialogueId = getProperty("dialogueId");
        const interactionType = getProperty("interactionType");

        if (
          typeof object.x !== "number" ||
          typeof object.y !== "number" ||
          typeof object.name !== "string" ||
          typeof displayName !== "string" ||
          typeof direction !== "string" ||
          typeof sprite !== "string" ||
          typeof dialogueId !== "string"
        ) {
          throw new Error(`Invalid NPC definition: ${object.name}`);
        }

        if (!this.isNpcDirection(direction)) {
          throw new Error(`Invalid NPC direction: ${direction}`);
        }

        if (!this.isNpcInteractionType(interactionType)) {
          throw new Error(`Invalid NPC interaction type: ${String(interactionType)}`);
        }

        return {
          id: object.name,
          x: object.x,
          y: object.y,
          displayName,
          direction,
          sprite,
          interactionType,
          dialogueId,
        };
      });
  }

  private isNpcDirection(value: string): value is NpcDirection {
    return value === "up" || value === "down" || value === "left" || value === "right";
  }

  private isNpcInteractionType(value: unknown): value is NpcInteractionType {
    return value === "dialogue" || value === "shop" || value === "quest";
  }
}
