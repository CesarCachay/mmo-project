import Phaser from "phaser";
import {
  getPokemonTrainerBattleDefinition,
  isPokemonShopCatalogId,
  isPokemonTrainerBattleId,
} from "@cesar-mmo/shared";
import type { PokemonShopCatalogId, PokemonTrainerBattleId } from "@cesar-mmo/shared";
import { getNpcTextureKeyCandidates } from "../config/npcAssets";
import { getGymLeaderOverworldLabelPresentation } from "../gym-leader/gym-leader-overworld-state";

import type {
  NpcDefinition,
  NpcDirection,
  NpcInstance,
  NpcInteractionType,
  NpcPostDialogueAction,
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
  private defeatedTrainerBattleIds = new Set<string>();

  constructor(scene: Phaser.Scene, createNameLabel: CreateNameLabel) {
    this.scene = scene;
    this.createNameLabel = createNameLabel;
  }

  public create(map: Phaser.Tilemaps.Tilemap): void {
    const npcDefinitions = this.getNpcDefinitions(map);

    for (const npc of npcDefinitions) {
      const textureCandidates = getNpcTextureKeyCandidates(
        npc.sprite,
        npc.direction,
      );
      const textureKey = textureCandidates.find((candidate) =>
        this.scene.textures.exists(candidate),
      );

      if (!textureKey) {
        throw new Error(
          `NPC texture not found for ${npc.sprite}; tried: ${textureCandidates.join(", ")}`,
        );
      }

      const sprite = this.scene.add.sprite(npc.x, npc.y, textureKey, 0);
      sprite.setDepth(5);
      const nameLabel = this.createNameLabel(npc.displayName);
      nameLabel.setPosition(Math.round(npc.x), Math.round(npc.y - 14));

      const instance: NpcInstance = {
        definition: npc,
        sprite,
        nameLabel,
      };

      this.npcs.set(npc.id, instance);
      this.applyProgressPresentation(instance);
    }
  }

  public destroy(): void {
    for (const npc of this.npcs.values()) {
      npc.sprite.destroy();
      npc.nameLabel.destroy();
    }

    this.npcs.clear();
  }

  public getById(npcId: string): NpcInstance | undefined {
    return this.npcs.get(npcId);
  }

  public setDefeatedTrainerBattleIds(
    trainerBattleIds: readonly string[],
  ): void {
    this.defeatedTrainerBattleIds = new Set(trainerBattleIds);

    for (const npc of this.npcs.values()) {
      this.applyProgressPresentation(npc);
    }
  }

  private applyProgressPresentation(npc: NpcInstance): void {
    const presentation = getGymLeaderOverworldLabelPresentation({
      displayName: npc.definition.displayName,
      trainerBattleId: npc.definition.trainerBattleId,
      defeatedTrainerBattleIds: this.defeatedTrainerBattleIds,
    });

    npc.nameLabel.setText(presentation.text);
    npc.nameLabel.setColor(presentation.completed ? "#facc15" : "#ffffff");
  }

  public getTrainerBattleNpcs(): readonly NpcInstance[] {
    return Array.from(this.npcs.values()).filter((npc) => {
      if (npc.definition.interactionType !== "trainer-battle") {
        return false;
      }

      const trainerBattleId = npc.definition.trainerBattleId;
      if (!trainerBattleId) {
        return false;
      }

      return getPokemonTrainerBattleDefinition(trainerBattleId).category === "standard";
    });
  }

  public findNearby(
    playerX: number,
    playerY: number,
    interactionDistance: number,
  ): NpcInstance | undefined {
    let nearestNpc: NpcInstance | undefined;
    let nearestDistance = interactionDistance;

    for (const npc of this.npcs.values()) {
      const distance = Phaser.Math.Distance.Between(
        playerX,
        playerY,
        npc.sprite.x,
        npc.sprite.y,
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

        const rawDisplayName = getProperty("displayName");
        const direction = getProperty("direction");
        const rawSprite = getProperty("sprite");
        const rawDialogueId = getProperty("dialogueId");
        const interactionType = getProperty("interactionType");
        const rawTrainerBattleId = getProperty("trainerBattleId");
        const rawShopCatalogId = getProperty("shopCatalogId");
        const rawSightRangeTiles = getProperty("sightRangeTiles");
        const rawPostDialogueAction = getProperty("postDialogueAction");

        if (
          typeof object.x !== "number" ||
          typeof object.y !== "number" ||
          typeof object.name !== "string" ||
          typeof direction !== "string"
        ) {
          throw new Error(`Invalid NPC definition: ${object.name}`);
        }

        if (!this.isNpcDirection(direction)) {
          throw new Error(`Invalid NPC direction: ${direction}`);
        }

        if (!this.isNpcInteractionType(interactionType)) {
          throw new Error(
            `Invalid NPC interaction type: ${String(interactionType)}`,
          );
        }

        const dialogueId = this.parseOptionalStringProperty(
          rawDialogueId,
          "dialogueId",
          object.name,
        );

        const trainerBattleId = this.parseTrainerBattleId(
          rawTrainerBattleId,
          object.name,
        );

        const shopCatalogId = this.parseShopCatalogId(
          rawShopCatalogId,
          object.name,
        );

        const sightRangeTiles = this.parseSightRangeTiles(
          rawSightRangeTiles,
          object.name,
        );

        let displayName: string;
        let sprite: string;

        if (interactionType === "trainer-battle") {
          if (!trainerBattleId) {
            throw new Error(
              `Trainer NPC "${object.name}" requires trainerBattleId`,
            );
          }

          if (!sightRangeTiles) {
            throw new Error(
              `Trainer NPC "${object.name}" requires sightRangeTiles`,
            );
          }

          const trainerDefinition =
            getPokemonTrainerBattleDefinition(trainerBattleId);

          displayName = trainerDefinition.displayName;
          sprite = trainerDefinition.appearanceId;
        } else {
          if (trainerBattleId) {
            throw new Error(
              `NPC "${object.name}" cannot define trainerBattleId unless interactionType is "trainer-battle"`,
            );
          }

          if (sightRangeTiles) {
            throw new Error(
              `NPC "${object.name}" cannot define sightRangeTiles unless interactionType is "trainer-battle"`,
            );
          }

          if (
            typeof rawDisplayName !== "string" ||
            rawDisplayName.trim().length === 0 ||
            typeof rawSprite !== "string" ||
            rawSprite.trim().length === 0
          ) {
            throw new Error(`Invalid NPC definition: ${object.name}`);
          }

          displayName = rawDisplayName.trim();
          sprite = rawSprite.trim();
        }

        if (interactionType === "shop") {
          if (!shopCatalogId) {
            throw new Error(
              `Shop NPC "${object.name}" requires shopCatalogId`,
            );
          }
        } else if (shopCatalogId) {
          throw new Error(
            `NPC "${object.name}" cannot define shopCatalogId unless interactionType is "shop"`,
          );
        }

        if (interactionType === "dialogue" && !dialogueId) {
          throw new Error(
            `Dialogue NPC "${object.name}" requires dialogueId`,
          );
        }

        let postDialogueAction: NpcPostDialogueAction | undefined;

        if (rawPostDialogueAction !== undefined) {
          if (rawPostDialogueAction !== "chooseStarter") {
            throw new Error(
              `Invalid NPC post dialogue action: ${String(
                rawPostDialogueAction,
              )}`,
            );
          }

          postDialogueAction = rawPostDialogueAction;
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
          trainerBattleId,
          shopCatalogId,
          sightRangeTiles,
          postDialogueAction,
        };
      });
  }

  private parseOptionalStringProperty(
    value: unknown,
    propertyName: string,
    npcId: string,
  ): string | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(
        `NPC "${npcId}" property "${propertyName}" must be a non-empty string`,
      );
    }

    return value.trim();
  }

  private parseTrainerBattleId(
    value: unknown,
    npcId: string,
  ): PokemonTrainerBattleId | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (!isPokemonTrainerBattleId(value)) {
      throw new Error(
        `NPC "${npcId}" references unknown trainerBattleId: ${String(value)}`,
      );
    }

    return value;
  }

  private parseShopCatalogId(
    value: unknown,
    npcId: string,
  ): PokemonShopCatalogId | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (!isPokemonShopCatalogId(value)) {
      throw new Error(
        `NPC "${npcId}" references unknown shopCatalogId: ${String(value)}`,
      );
    }

    return value;
  }

  private parseSightRangeTiles(
    value: unknown,
    npcId: string,
  ): number | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (
      typeof value !== "number" ||
      !Number.isInteger(value) ||
      value <= 0 ||
      value > 20
    ) {
      throw new Error(
        `NPC "${npcId}" property "sightRangeTiles" must be an integer between 1 and 20`,
      );
    }

    return value;
  }

  private isNpcDirection(value: string): value is NpcDirection {
    return (
      value === "up" ||
      value === "down" ||
      value === "left" ||
      value === "right"
    );
  }

  private isNpcInteractionType(value: unknown): value is NpcInteractionType {
    return (
      value === "dialogue" ||
      value === "shop" ||
      value === "quest" ||
      value === "trainer-battle"
    );
  }
}
