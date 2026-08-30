import Phaser from "phaser";
import { PLAYER_SIZE } from "@cesar-mmo/shared";
import type { Direction, PokemonFollowerPublicState } from "@cesar-mmo/shared";
import { getPokemonOverworldSpriteAsset } from "./pokemon-overworld-sprite.registry";
import type { PokemonOverworldDirection } from "./pokemon-overworld-sprite.registry";

interface TrailPoint {
  x: number;
  y: number;
}

const FOLLOW_DISTANCE = 18;

const TRAIL_SAMPLE_DISTANCE = 1;

const MAX_TRAIL_POINTS = 180;

const WALK_FRAME_DURATION = 180;

export class PokemonFollowerController {
  private readonly scene: Phaser.Scene;

  private follower?: Phaser.GameObjects.Image;

  private pokemon?: PokemonFollowerPublicState;

  private direction: PokemonOverworldDirection = "down";

  private frame: 1 | 2 = 1;

  private frameElapsed = 0;

  private trail: TrailPoint[] = [];

  private lastPlayerPosition?: TrailPoint;
  private followerPosition?: TrailPoint;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public create(
    pokemon: PokemonFollowerPublicState,
    playerX: number,
    playerY: number,
    playerDirection: Direction
  ): void {
    this.destroy();

    this.pokemon = pokemon;

    this.direction = this.toOverworldDirection(playerDirection);

    const initialFollowerPosition = this.getInitialFollowerPosition(
      playerX,
      playerY,
      this.direction
    );

    this.trail = [
      initialFollowerPosition,
      {
        x: playerX,
        y: playerY,
      },
    ];

    this.lastPlayerPosition = {
      x: playerX,
      y: playerY,
    };

    const asset = getPokemonOverworldSpriteAsset(
      pokemon.speciesId,
      pokemon.formId,
      this.direction,
      1
    );

    this.follower = this.scene.add
      .image(initialFollowerPosition.x, initialFollowerPosition.y, asset.textureKey)
      .setOrigin(0.5, 0.5);

    this.followerPosition = {
      ...initialFollowerPosition,
    };

    this.applyFollowerRenderPosition(initialFollowerPosition);

    this.updateDepth();
  }

  public update(
    playerX: number,
    playerY: number,
    _playerDirection: Direction,
    delta: number
  ): void {
    if (!this.follower || !this.pokemon) {
      return;
    }

    this.recordPlayerPosition(playerX, playerY);
    const target = this.getFollowerTargetFromTrail();
    const previousPosition = this.followerPosition ?? target;
    const movementX = target.x - previousPosition.x;
    const movementY = target.y - previousPosition.y;

    this.followerPosition = {
      ...target,
    };

    this.applyFollowerRenderPosition(target);
    const movementDistance = Math.hypot(movementX, movementY);
    const isMoving = movementDistance > 0.1;

    if (isMoving) {
      this.direction = this.getDirectionFromMovement(movementX, movementY);
    }
    this.updateAnimation(delta, isMoving);
    this.updateDepth();
  }

  public destroy(): void {
    this.follower?.destroy();

    this.follower = undefined;
    this.pokemon = undefined;

    this.direction = "down";

    this.frame = 1;
    this.frameElapsed = 0;

    this.trail = [];
    this.lastPlayerPosition = undefined;
    this.followerPosition = undefined;
  }

  public exists(): boolean {
    return Boolean(this.follower && this.pokemon);
  }

  private recordPlayerPosition(playerX: number, playerY: number): void {
    const last = this.lastPlayerPosition;

    if (!last) {
      this.lastPlayerPosition = {
        x: playerX,
        y: playerY,
      };

      this.trail.push({
        x: playerX,
        y: playerY,
      });

      return;
    }

    const distance = Phaser.Math.Distance.Between(last.x, last.y, playerX, playerY);

    if (distance < TRAIL_SAMPLE_DISTANCE) {
      return;
    }

    const point = {
      x: playerX,
      y: playerY,
    };

    this.trail.push(point);

    this.lastPlayerPosition = point;

    while (this.trail.length > MAX_TRAIL_POINTS) {
      this.trail.shift();
    }
  }

  private getFollowerTargetFromTrail(): TrailPoint {
    if (this.trail.length === 0) {
      return {
        x: this.follower?.x ?? 0,
        y: this.follower?.y ?? 0,
      };
    }

    let remainingDistance = FOLLOW_DISTANCE;

    for (let index = this.trail.length - 1; index > 0; index -= 1) {
      const current = this.trail[index];
      const previous = this.trail[index - 1];
      const segmentDistance = Phaser.Math.Distance.Between(
        current.x,
        current.y,
        previous.x,
        previous.y
      );

      if (segmentDistance >= remainingDistance) {
        const ratio = remainingDistance / segmentDistance;

        return {
          x: Phaser.Math.Linear(current.x, previous.x, ratio),
          y: Phaser.Math.Linear(current.y, previous.y, ratio),
        };
      }

      remainingDistance -= segmentDistance;
    }

    return this.trail[0];
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

  private getDirectionFromMovement(
    movementX: number,
    movementY: number
  ): PokemonOverworldDirection {
    if (Math.abs(movementX) > Math.abs(movementY)) {
      return movementX > 0 ? "right" : "left";
    }

    return movementY > 0 ? "down" : "up";
  }

  private getInitialFollowerPosition(
    playerX: number,
    playerY: number,
    direction: PokemonOverworldDirection
  ): TrailPoint {
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
    const feetY = this.follower.y + this.follower.displayHeight / 2;
    this.follower.setDepth(feetY);
  }

  private toOverworldDirection(direction: Direction): PokemonOverworldDirection {
    return direction;
  }

  private applyFollowerRenderPosition(position: TrailPoint): void {
    if (!this.follower) {
      return;
    }

    const followerHeight = this.follower.displayHeight;
    const baselineOffset = (followerHeight - PLAYER_SIZE) / 2;
    this.follower.setPosition(position.x, position.y - baselineOffset);
  }

  public resetToPlayerPosition(
    playerX: number,
    playerY: number,
    playerDirection: Direction
  ): void {
    if (!this.follower || !this.pokemon) {
      return;
    }

    this.direction = this.toOverworldDirection(playerDirection);

    const followerPosition = this.getInitialFollowerPosition(
      playerX,
      playerY,
      this.direction
    );

    this.trail = [
      followerPosition,
      {
        x: playerX,
        y: playerY,
      },
    ];

    this.lastPlayerPosition = {
      x: playerX,
      y: playerY,
    };

    this.followerPosition = {
      ...followerPosition,
    };

    this.frame = 1;
    this.frameElapsed = 0;

    this.applyFollowerRenderPosition(followerPosition);

    this.applyTexture();
    this.updateDepth();
  }
}
