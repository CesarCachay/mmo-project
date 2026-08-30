import Phaser from "phaser";

import { getPlayerAnimationKey, getPlayerTextureKey } from "../config/playerAssets";

import type { Player } from "@cesar-mmo/shared";

export interface RemotePlayerRenderPosition {
  x: number;
  y: number;
}

type CreateNameLabel = (displayName: string) => Phaser.GameObjects.Text;

const PLAYER_NAME_GAP = 5;

export class RemotePlayerManager {
  private readonly scene: Phaser.Scene;
  private readonly createNameLabel: CreateNameLabel;

  private readonly players = new Map<string, Phaser.GameObjects.Sprite>();
  private readonly targets = new Map<string, { x: number; y: number }>();
  private readonly nameLabels = new Map<string, Phaser.GameObjects.Text>();

  constructor(scene: Phaser.Scene, createNameLabel: CreateNameLabel) {
    this.scene = scene;
    this.createNameLabel = createNameLabel;
  }

  public add(player: Player): void {
    if (this.players.has(player.id)) {
      return;
    }

    const sprite = this.scene.add.sprite(
      player.x,
      player.y,
      getPlayerTextureKey(player.avatarId, player.direction),
      0
    );

    sprite.setDepth(5);
    const nameLabel = this.createNameLabel(player.displayName);
    this.players.set(player.id, sprite);
    this.nameLabels.set(player.id, nameLabel);

    this.targets.set(player.id, {
      x: player.x,
      y: player.y,
    });

    this.updateAnimation(sprite, player);
  }

  public update(player: Player): void {
    const sprite = this.players.get(player.id);

    if (!sprite) {
      this.add(player);
      return;
    }

    this.targets.set(player.id, {
      x: player.x,
      y: player.y,
    });

    this.updateAnimation(sprite, player);
  }

  public remove(playerId: string): void {
    this.players.get(playerId)?.destroy();
    this.nameLabels.get(playerId)?.destroy();
    this.players.delete(playerId);
    this.targets.delete(playerId);
    this.nameLabels.delete(playerId);
  }

  public clear(): void {
    for (const playerId of Array.from(this.players.keys())) {
      this.remove(playerId);
    }
  }

  public interpolate(delta: number): void {
    const interpolationRate = 12;
    const alpha = 1 - Math.exp(-interpolationRate * (delta / 1000));

    for (const [playerId, sprite] of this.players) {
      const target = this.targets.get(playerId);
      if (!target) {
        continue;
      }

      sprite.x = Phaser.Math.Linear(sprite.x, target.x, alpha);
      sprite.y = Phaser.Math.Linear(sprite.y, target.y, alpha);
      const nameLabel = this.nameLabels.get(playerId);
      if (nameLabel) {
        nameLabel.setPosition(
          Math.round(sprite.x),
          Math.round(sprite.y - sprite.displayHeight / 2 - PLAYER_NAME_GAP)
        );
        // nameLabel.setPosition(Math.round(sprite.x), Math.round(sprite.y - 14));
      }
    }
  }

  private updateAnimation(sprite: Phaser.GameObjects.Sprite, player: Player): void {
    if (player.isMoving) {
      sprite.play(getPlayerAnimationKey(player.avatarId, player.direction), true);
      return;
    }

    sprite.anims.stop();
    sprite.setTexture(getPlayerTextureKey(player.avatarId, player.direction), 0);
  }

  public getRenderPosition(playerId: string): RemotePlayerRenderPosition | undefined {
    const sprite = this.players.get(playerId);

    if (!sprite) {
      return undefined;
    }

    return {
      x: sprite.x,
      y: sprite.y,
    };
  }
}
