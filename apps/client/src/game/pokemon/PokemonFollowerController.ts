import Phaser from "phaser";

import type { Direction, PokemonInstance } from "@cesar-mmo/shared";

import {
  getPokemonOverworldSpriteAsset,
  type PokemonOverworldDirection,
} from "./pokemon-overworld-sprite.registry";

const FOLLOW_DISTANCE = 22;

const FOLLOW_INTERPOLATION_RATE = 8;

const WALK_FRAME_DURATION = 180;

export class PokemonFollowerController {
  private readonly scene: Phaser.Scene;

  private follower?: Phaser.GameObjects.Image;

  private pokemon?: PokemonInstance;

  private direction: PokemonOverworldDirection = "down";

  private frame: 1 | 2 = 1;

  private frameElapsed = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public create(
    pokemon: PokemonInstance,
    playerX: number,
    playerY: number,
    playerDirection: Direction
  ): void {
    this.destroy();

    this.pokemon = pokemon;
    this.direction = this.toOverworldDirection(playerDirection);

    const position = this.getTargetPosition(playerX, playerY, this.direction);

    const asset = getPokemonOverworldSpriteAsset(
      pokemon.speciesId,
      pokemon.formId,
      this.direction,
      1
    );

    this.follower = this.scene.add
      .image(position.x, position.y, asset.textureKey)
      .setOrigin(0.5, 1);

    this.updateDepth();
  }

  public update(
    playerX: number,
    playerY: number,
    playerDirection: Direction,
    delta: number
  ): void {
    if (!this.follower || !this.pokemon) {
      return;
    }

    const direction = this.toOverworldDirection(playerDirection);

    const target = this.getTargetPosition(playerX, playerY, direction);

    const alpha = 1 - Math.exp(-FOLLOW_INTERPOLATION_RATE * (delta / 1000));

    this.follower.x = Phaser.Math.Linear(this.follower.x, target.x, alpha);

    this.follower.y = Phaser.Math.Linear(this.follower.y, target.y, alpha);

    const distance = Phaser.Math.Distance.Between(
      this.follower.x,
      this.follower.y,
      target.x,
      target.y
    );

    const isMoving = distance > 1;

    this.direction = direction;

    this.updateAnimation(delta, isMoving);
    this.updateDepth();
  }

  public destroy(): void {
    this.follower?.destroy();

    this.follower = undefined;
    this.pokemon = undefined;

    this.frame = 1;
    this.frameElapsed = 0;
  }

  public exists(): boolean {
    return Boolean(this.follower && this.pokemon);
  }

  private updateAnimation(delta: number, isMoving: boolean): void {
    if (!this.follower || !this.pokemon) {
      return;
    }

    if (!isMoving) {
      this.frame = 1;
      this.frameElapsed = 0;

      this.applyTexture();
      return;
    }

    this.frameElapsed += delta;

    if (this.frameElapsed >= WALK_FRAME_DURATION) {
      this.frameElapsed = 0;

      this.frame = this.frame === 1 ? 2 : 1;
    }

    this.applyTexture();
  }

  private applyTexture(): void {
    if (!this.follower || !this.pokemon) {
      return;
    }

    const asset = getPokemonOverworldSpriteAsset(
      this.pokemon.speciesId,
      this.pokemon.formId,
      this.direction,
      this.frame
    );

    if (this.follower.texture.key === asset.textureKey) {
      return;
    }

    this.follower.setTexture(asset.textureKey);
  }

  private getTargetPosition(
    playerX: number,
    playerY: number,
    direction: PokemonOverworldDirection
  ): {
    x: number;
    y: number;
  } {
    switch (direction) {
      case "up":
        return {
          x: playerX,
          y: playerY + FOLLOW_DISTANCE,
        };

      case "down":
        return {
          x: playerX,
          y: playerY - FOLLOW_DISTANCE,
        };

      case "left":
        return {
          x: playerX + FOLLOW_DISTANCE,
          y: playerY,
        };

      case "right":
        return {
          x: playerX - FOLLOW_DISTANCE,
          y: playerY,
        };
    }
  }

  private updateDepth(): void {
    if (!this.follower) {
      return;
    }
    this.follower.setDepth(this.follower.y);
  }

  private toOverworldDirection(direction: Direction): PokemonOverworldDirection {
    return direction;
  }
}
